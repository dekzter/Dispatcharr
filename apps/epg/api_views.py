import logging, os
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from django.utils import timezone
from datetime import timedelta
from .models import EPGSource, ProgramData, EPGData  # Added ProgramData
from .serializers import (
    ProgramDataSerializer,
    EPGSourceSerializer,
    EPGDataSerializer,
)  # Updated serializer
from .tasks import refresh_epg_data
from apps.accounts.permissions import (
    permission_classes_by_action,
    permission_classes_by_method,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────
# 1) EPG Source API (CRUD)
# ─────────────────────────────
class EPGSourceViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows EPG sources to be viewed or edited.
    """

    queryset = EPGSource.objects.all()
    serializer_class = EPGSourceSerializer

    def get_permissions(self):
        try:
            return [perm() for perm in permission_classes_by_action[self.action]]
        except KeyError:
            return [IsAuthenticated()]

    def list(self, request, *args, **kwargs):
        logger.debug("Listing all EPG sources.")
        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=["post"])
    def upload(self, request):
        if "file" not in request.FILES:
            return Response(
                {"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST
            )

        file = request.FILES["file"]
        file_name = file.name
        file_path = os.path.join("/data/uploads/epgs", file_name)

        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, "wb+") as destination:
            for chunk in file.chunks():
                destination.write(chunk)

        new_obj_data = request.data.copy()
        new_obj_data["file_path"] = file_path

        serializer = self.get_serializer(data=new_obj_data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        """Handle partial updates with special logic for is_active field"""
        instance = self.get_object()

        # Check if we're toggling is_active
        if (
            "is_active" in request.data
            and instance.is_active != request.data["is_active"]
        ):
            # Set appropriate status based on new is_active value
            if request.data["is_active"]:
                request.data["status"] = "idle"
            else:
                request.data["status"] = "disabled"

        # Continue with regular partial update
        return super().partial_update(request, *args, **kwargs)


# ─────────────────────────────
# 2) Program API (CRUD)
# ─────────────────────────────
class ProgramViewSet(viewsets.ModelViewSet):
    """Handles CRUD operations for EPG programs"""

    queryset = ProgramData.objects.all()
    serializer_class = ProgramDataSerializer

    def get_permissions(self):
        try:
            return [perm() for perm in permission_classes_by_action[self.action]]
        except KeyError:
            return [IsAuthenticated()]

    def list(self, request, *args, **kwargs):
        logger.debug("Listing all EPG programs.")
        return super().list(request, *args, **kwargs)


# ─────────────────────────────
# 3) EPG Grid View
# ─────────────────────────────
class EPGGridAPIView(APIView):
    """Returns all programs airing in the next 24 hours including currently running ones and recent ones"""

    def get_permissions(self):
        try:
            return [
                perm() for perm in permission_classes_by_method[self.request.method]
            ]
        except KeyError:
            return [IsAuthenticated()]

    @swagger_auto_schema(
        operation_description="Retrieve programs from the previous hour, currently running and upcoming for the next 24 hours",
        responses={200: ProgramDataSerializer(many=True)},
    )
    def get(self, request, format=None):
        # Use current time instead of midnight
        now = timezone.now()
        one_hour_ago = now - timedelta(hours=1)
        twenty_four_hours_later = now + timedelta(hours=24)
        logger.debug(
            f"EPGGridAPIView: Querying programs between {one_hour_ago} and {twenty_four_hours_later}."
        )

        # Use select_related to prefetch EPGData and include programs from the last hour
        programs = ProgramData.objects.select_related("epg").filter(
            # Programs that end after one hour ago (includes recently ended programs)
            end_time__gt=one_hour_ago,
            # AND start before the end time window
            start_time__lt=twenty_four_hours_later,
        )
        count = programs.count()
        logger.debug(
            f"EPGGridAPIView: Found {count} program(s), including recently ended, currently running, and upcoming shows."
        )

        # Generate dummy programs for channels that have no EPG data
        from apps.channels.models import Channel
        from django.db.models import Q

        # Get channels with no EPG data
        channels_without_epg = Channel.objects.filter(Q(epg_data__isnull=True))
        channels_count = channels_without_epg.count()

        # Log more detailed information about channels missing EPG data
        if channels_count > 0:
            channel_names = [f"{ch.name} (ID: {ch.id})" for ch in channels_without_epg]
            logger.warning(
                f"EPGGridAPIView: Missing EPG data for these channels: {', '.join(channel_names)}"
            )

        logger.debug(
            f"EPGGridAPIView: Found {channels_count} channels with no EPG data."
        )

        # Serialize the regular programs
        serialized_programs = ProgramDataSerializer(programs, many=True).data

        # Humorous program descriptions based on time of day - same as in output/views.py
        time_descriptions = {
            (0, 4): [
                "Late Night with {channel} - Where insomniacs unite!",
                "The 'Why Am I Still Awake?' Show on {channel}",
                "Counting Sheep - A {channel} production for the sleepless",
            ],
            (4, 8): [
                "Dawn Patrol - Rise and shine with {channel}!",
                "Early Bird Special - Coffee not included",
                "Morning Zombies - Before coffee viewing on {channel}",
            ],
            (8, 12): [
                "Mid-Morning Meetings - Pretend you're paying attention while watching {channel}",
                "The 'I Should Be Working' Hour on {channel}",
                "Productivity Killer - {channel}'s daytime programming",
            ],
            (12, 16): [
                "Lunchtime Laziness with {channel}",
                "The Afternoon Slump - Brought to you by {channel}",
                "Post-Lunch Food Coma Theater on {channel}",
            ],
            (16, 20): [
                "Rush Hour - {channel}'s alternative to traffic",
                "The 'What's For Dinner?' Debate on {channel}",
                "Evening Escapism - {channel}'s remedy for reality",
            ],
            (20, 24): [
                "Prime Time Placeholder - {channel}'s finest not-programming",
                "The 'Netflix Was Too Complicated' Show on {channel}",
                "Family Argument Avoider - Courtesy of {channel}",
            ],
        }

        # Generate and append dummy programs
        dummy_programs = []
        for channel in channels_without_epg:
            # Use the channel UUID as tvg_id for dummy programs to match in the guide
            dummy_tvg_id = str(channel.uuid)

            try:
                # Create programs every 4 hours for the next 24 hours
                for hour_offset in range(0, 24, 4):
                    # Use timedelta for time arithmetic instead of replace() to avoid hour overflow
                    start_time = now + timedelta(hours=hour_offset)
                    # Set minutes/seconds to zero for clean time blocks
                    start_time = start_time.replace(minute=0, second=0, microsecond=0)
                    end_time = start_time + timedelta(hours=4)

                    # Get the hour for selecting a description
                    hour = start_time.hour
                    day = 0  # Use 0 as we're only doing 1 day

                    # Find the appropriate time slot for description
                    for time_range, descriptions in time_descriptions.items():
                        start_range, end_range = time_range
                        if start_range <= hour < end_range:
                            # Pick a description using the sum of the hour and day as seed
                            # This makes it somewhat random but consistent for the same timeslot
                            description = descriptions[
                                (hour + day) % len(descriptions)
                            ].format(channel=channel.name)
                            break
                    else:
                        # Fallback description if somehow no range matches
                        description = f"Placeholder program for {channel.name} - EPG data went on vacation"

                    # Create a dummy program in the same format as regular programs
                    dummy_program = {
                        "id": f"dummy-{channel.id}-{hour_offset}",  # Create a unique ID
                        "epg": {"tvg_id": dummy_tvg_id, "name": channel.name},
                        "start_time": start_time.isoformat(),
                        "end_time": end_time.isoformat(),
                        "title": f"{channel.name}",
                        "description": description,
                        "tvg_id": dummy_tvg_id,
                        "sub_title": None,
                        "custom_properties": None,
                    }
                    dummy_programs.append(dummy_program)

            except Exception as e:
                logger.error(
                    f"Error creating dummy programs for channel {channel.name} (ID: {channel.id}): {str(e)}"
                )

        # Combine regular and dummy programs
        all_programs = list(serialized_programs) + dummy_programs
        logger.debug(
            f"EPGGridAPIView: Returning {len(all_programs)} total programs (including {len(dummy_programs)} dummy programs)."
        )

        return Response({"data": all_programs}, status=status.HTTP_200_OK)


# ─────────────────────────────
# 4) EPG Import View
# ─────────────────────────────
class EPGImportAPIView(APIView):
    """Triggers an EPG data refresh"""

    def get_permissions(self):
        try:
            return [
                perm() for perm in permission_classes_by_method[self.request.method]
            ]
        except KeyError:
            return [IsAuthenticated()]

    @swagger_auto_schema(
        operation_description="Triggers an EPG data import",
        responses={202: "EPG data import initiated"},
    )
    def post(self, request, format=None):
        logger.info("EPGImportAPIView: Received request to import EPG data.")
        refresh_epg_data.delay(request.data.get("id", None))  # Trigger Celery task
        logger.info("EPGImportAPIView: Task dispatched to refresh EPG data.")
        return Response(
            {"success": True, "message": "EPG data import initiated."},
            status=status.HTTP_202_ACCEPTED,
        )


# ─────────────────────────────
# 5) EPG Data View
# ─────────────────────────────
class EPGDataViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint that allows EPGData objects to be viewed.
    """

    queryset = EPGData.objects.all()
    serializer_class = EPGDataSerializer

    def get_permissions(self):
        try:
            return [perm() for perm in permission_classes_by_action[self.action]]
        except KeyError:
            return [IsAuthenticated()]
