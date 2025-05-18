from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from apps.accounts.permissions import permission_classes_by_action
from apps.accounts.permissions import permission_classes_by_action
from django.http import JsonResponse, HttpResponseForbidden, HttpResponse
import logging
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from django.shortcuts import get_object_or_404
from django.db import models
from apps.channels.models import Channel, ChannelProfile, Stream
from .models import HDHRDevice
from .serializers import HDHRDeviceSerializer
from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.views import View
from django.utils.decorators import method_decorator
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from apps.m3u.models import M3UAccountProfile

# Configure logger
logger = logging.getLogger(__name__)


@login_required
def hdhr_dashboard_view(request):
    """Render the HDHR management page."""
    hdhr_devices = HDHRDevice.objects.all()
    return render(request, "hdhr/hdhr.html", {"hdhr_devices": hdhr_devices})


# 🔹 1) HDHomeRun Device API
class HDHRDeviceViewSet(viewsets.ModelViewSet):
    """Handles CRUD operations for HDHomeRun devices"""

    queryset = HDHRDevice.objects.all()
    serializer_class = HDHRDeviceSerializer

    def get_permissions(self):
        try:
            return [perm() for perm in permission_classes_by_action[self.action]]
        except KeyError:
            return [IsAuthenticated()]


# 🔹 2) Discover API
class DiscoverAPIView(APIView):
    """Returns device discovery information"""

    @swagger_auto_schema(
        operation_description="Retrieve HDHomeRun device discovery information",
        responses={200: openapi.Response("HDHR Discovery JSON")},
    )
    def get(self, request, profile=None):
        uri_parts = ["hdhr"]
        if profile is not None:
            uri_parts.append(profile)

        base_url = request.build_absolute_uri(f'/{"/".join(uri_parts)}/').rstrip("/")
        device = HDHRDevice.objects.first()

        # Calculate tuner count from active profiles from active M3U accounts (excluding default "custom Default" profile)
        profiles = M3UAccountProfile.objects.filter(
            is_active=True,
            m3u_account__is_active=True,  # Only include profiles from enabled M3U accounts
        ).exclude(id=1)

        # 1. Check if any profile has unlimited streams (max_streams=0)
        has_unlimited = profiles.filter(max_streams=0).exists()

        # 2. Calculate tuner count from limited profiles
        limited_tuners = 0
        if not has_unlimited:
            limited_tuners = (
                profiles.filter(max_streams__gt=0)
                .aggregate(total=models.Sum("max_streams"))
                .get("total", 0)
                or 0
            )

        # 3. Add custom stream count to tuner count
        custom_stream_count = Stream.objects.filter(is_custom=True).count()
        logger.debug(f"Found {custom_stream_count} custom streams")

        # 4. Calculate final tuner count
        if has_unlimited:
            # If there are unlimited profiles, start with 10 plus custom streams
            tuner_count = 10 + custom_stream_count
        else:
            # Otherwise use the limited profile sum plus custom streams
            tuner_count = limited_tuners + custom_stream_count

        # 5. Ensure minimum of 2 tuners
        tuner_count = max(2, tuner_count)

        logger.debug(
            f"Calculated tuner count: {tuner_count} (limited profiles: {limited_tuners}, custom streams: {custom_stream_count}, unlimited: {has_unlimited})"
        )

        if not device:
            data = {
                "FriendlyName": "Dispatcharr HDHomeRun",
                "ModelNumber": "HDTC-2US",
                "FirmwareName": "hdhomerun3_atsc",
                "FirmwareVersion": "20200101",
                "DeviceID": "12345678",
                "DeviceAuth": "test_auth_token",
                "BaseURL": base_url,
                "LineupURL": f"{base_url}/lineup.json",
                "TunerCount": tuner_count,
            }
        else:
            data = {
                "FriendlyName": device.friendly_name,
                "ModelNumber": "HDTC-2US",
                "FirmwareName": "hdhomerun3_atsc",
                "FirmwareVersion": "20200101",
                "DeviceID": device.device_id,
                "DeviceAuth": "test_auth_token",
                "BaseURL": base_url,
                "LineupURL": f"{base_url}/lineup.json",
                "TunerCount": tuner_count,
            }
        return JsonResponse(data)


# 🔹 3) Lineup API
class LineupAPIView(APIView):
    """Returns available channel lineup"""

    @swagger_auto_schema(
        operation_description="Retrieve the available channel lineup",
        responses={200: openapi.Response("Channel Lineup JSON")},
    )
    def get(self, request, profile=None):
        if profile is not None:
            channel_profile = ChannelProfile.objects.get(name=profile)
            channels = Channel.objects.filter(
                channelprofilemembership__channel_profile=channel_profile,
                channelprofilemembership__enabled=True,
            ).order_by("channel_number")
        else:
            channels = Channel.objects.all().order_by("channel_number")

        lineup = []
        for ch in channels:
            # Format channel number as integer if it has no decimal component
            if ch.channel_number is not None:
                if ch.channel_number == int(ch.channel_number):
                    formatted_channel_number = str(int(ch.channel_number))
                else:
                    formatted_channel_number = str(ch.channel_number)
            else:
                formatted_channel_number = ""

            lineup.append(
                {
                    "GuideNumber": formatted_channel_number,
                    "GuideName": ch.name,
                    "URL": request.build_absolute_uri(f"/proxy/ts/stream/{ch.uuid}"),
                    "Guide_ID": formatted_channel_number,
                    "Station": formatted_channel_number,
                }
            )
        return JsonResponse(lineup, safe=False)


# 🔹 4) Lineup Status API
class LineupStatusAPIView(APIView):
    """Returns the current status of the HDHR lineup"""

    @swagger_auto_schema(
        operation_description="Retrieve the HDHomeRun lineup status",
        responses={200: openapi.Response("Lineup Status JSON")},
    )
    def get(self, request, profile=None):
        data = {
            "ScanInProgress": 0,
            "ScanPossible": 0,
            "Source": "Cable",
            "SourceList": ["Cable"],
        }
        return JsonResponse(data)


# 🔹 5) Device XML API
class HDHRDeviceXMLAPIView(APIView):
    """Returns HDHomeRun device configuration in XML"""

    @swagger_auto_schema(
        operation_description="Retrieve the HDHomeRun device XML configuration",
        responses={200: openapi.Response("HDHR Device XML")},
    )
    def get(self, request):
        base_url = request.build_absolute_uri("/hdhr/").rstrip("/")

        xml_response = f"""<?xml version="1.0" encoding="utf-8"?>
        <root>
            <DeviceID>12345678</DeviceID>
            <FriendlyName>Dispatcharr HDHomeRun</FriendlyName>
            <ModelNumber>HDTC-2US</ModelNumber>
            <FirmwareName>hdhomerun3_atsc</FirmwareName>
            <FirmwareVersion>20200101</FirmwareVersion>
            <DeviceAuth>test_auth_token</DeviceAuth>
            <BaseURL>{base_url}</BaseURL>
            <LineupURL>{base_url}/lineup.json</LineupURL>
        </root>"""

        return HttpResponse(xml_response, content_type="application/xml")
