from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from apps.accounts.permissions import (
    permission_classes_by_action,
    permission_classes_by_method,
)
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.core.cache import cache
import os
from rest_framework.decorators import action
from django.conf import settings
from .tasks import refresh_m3u_groups

# Import all models, including UserAgent.
from .models import M3UAccount, M3UFilter, ServerGroup, M3UAccountProfile
from core.models import UserAgent
from apps.channels.models import ChannelGroupM3UAccount
from core.serializers import UserAgentSerializer

# Import all serializers, including the UserAgentSerializer.
from .serializers import (
    M3UAccountSerializer,
    M3UFilterSerializer,
    ServerGroupSerializer,
    M3UAccountProfileSerializer,
)

from .tasks import refresh_single_m3u_account, refresh_m3u_accounts
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile


class M3UAccountViewSet(viewsets.ModelViewSet):
    """Handles CRUD operations for M3U accounts"""

    queryset = M3UAccount.objects.prefetch_related("channel_group")
    serializer_class = M3UAccountSerializer

    def get_permissions(self):
        try:
            return [perm() for perm in permission_classes_by_action[self.action]]
        except KeyError:
            return [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        # Handle file upload first, if any
        file_path = None
        if "file" in request.FILES:
            file = request.FILES["file"]
            file_name = file.name
            file_path = os.path.join("/data/uploads/m3us", file_name)

            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, "wb+") as destination:
                for chunk in file.chunks():
                    destination.write(chunk)

            # Add file_path to the request data so it's available during creation
            request.data._mutable = True  # Allow modification of the request data
            request.data["file_path"] = (
                file_path  # Include the file path if a file was uploaded
            )
            request.data.pop("server_url")
            request.data._mutable = False  # Make the request data immutable again

        # Now call super().create() to create the instance
        response = super().create(request, *args, **kwargs)

        print(response.data.get("account_type"))
        if response.data.get("account_type") == M3UAccount.Types.XC:
            refresh_m3u_groups(response.data.get("id"))

        # After the instance is created, return the response
        return response

    def update(self, request, *args, **kwargs):
        instance = self.get_object()

        # Handle file upload first, if any
        file_path = None
        if "file" in request.FILES:
            file = request.FILES["file"]
            file_name = file.name
            file_path = os.path.join("/data/uploads/m3us", file_name)

            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, "wb+") as destination:
                for chunk in file.chunks():
                    destination.write(chunk)

            # Add file_path to the request data so it's available during creation
            request.data._mutable = True  # Allow modification of the request data
            request.data["file_path"] = (
                file_path  # Include the file path if a file was uploaded
            )
            request.data.pop("server_url")
            request.data._mutable = False  # Make the request data immutable again

            if instance.file_path and os.path.exists(instance.file_path):
                os.remove(instance.file_path)

        # Now call super().create() to create the instance
        response = super().update(request, *args, **kwargs)

        # After the instance is created, return the response
        return response

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
                request.data["status"] = M3UAccount.Status.IDLE
            else:
                request.data["status"] = M3UAccount.Status.DISABLED

        # Continue with regular partial update
        return super().partial_update(request, *args, **kwargs)


class M3UFilterViewSet(viewsets.ModelViewSet):
    """Handles CRUD operations for M3U filters"""

    queryset = M3UFilter.objects.all()
    serializer_class = M3UFilterSerializer

    def get_permissions(self):
        try:
            return [perm() for perm in permission_classes_by_action[self.action]]
        except KeyError:
            return [IsAuthenticated()]


class ServerGroupViewSet(viewsets.ModelViewSet):
    """Handles CRUD operations for Server Groups"""

    queryset = ServerGroup.objects.all()
    serializer_class = ServerGroupSerializer

    def get_permissions(self):
        try:
            return [perm() for perm in permission_classes_by_action[self.action]]
        except KeyError:
            return [IsAuthenticated()]


class RefreshM3UAPIView(APIView):
    """Triggers refresh for all active M3U accounts"""

    def get_permissions(self):
        try:
            return [
                perm() for perm in permission_classes_by_method[self.request.method]
            ]
        except KeyError:
            return [IsAuthenticated()]

    @swagger_auto_schema(
        operation_description="Triggers a refresh of all active M3U accounts",
        responses={202: "M3U refresh initiated"},
    )
    def post(self, request, format=None):
        refresh_m3u_accounts.delay()
        return Response(
            {"success": True, "message": "M3U refresh initiated."},
            status=status.HTTP_202_ACCEPTED,
        )


class RefreshSingleM3UAPIView(APIView):
    """Triggers refresh for a single M3U account"""

    def get_permissions(self):
        try:
            return [
                perm() for perm in permission_classes_by_method[self.request.method]
            ]
        except KeyError:
            return [IsAuthenticated()]

    @swagger_auto_schema(
        operation_description="Triggers a refresh of a single M3U account",
        responses={202: "M3U account refresh initiated"},
    )
    def post(self, request, account_id, format=None):
        refresh_single_m3u_account.delay(account_id)
        return Response(
            {
                "success": True,
                "message": f"M3U account {account_id} refresh initiated.",
            },
            status=status.HTTP_202_ACCEPTED,
        )


class UserAgentViewSet(viewsets.ModelViewSet):
    """Handles CRUD operations for User Agents"""

    queryset = UserAgent.objects.all()
    serializer_class = UserAgentSerializer

    def get_permissions(self):
        try:
            return [perm() for perm in permission_classes_by_action[self.action]]
        except KeyError:
            return [IsAuthenticated()]


class M3UAccountProfileViewSet(viewsets.ModelViewSet):
    queryset = M3UAccountProfile.objects.all()
    serializer_class = M3UAccountProfileSerializer

    def get_permissions(self):
        try:
            return [perm() for perm in permission_classes_by_action[self.action]]
        except KeyError:
            return [IsAuthenticated()]

    def get_queryset(self):
        m3u_account_id = self.kwargs["account_id"]
        return M3UAccountProfile.objects.filter(m3u_account_id=m3u_account_id)

    def perform_create(self, serializer):
        # Get the account ID from the URL
        account_id = self.kwargs["account_id"]

        # Get the M3UAccount instance for the account_id
        m3u_account = M3UAccount.objects.get(id=account_id)

        # Save the 'm3u_account' in the serializer context
        serializer.context["m3u_account"] = m3u_account

        # Perform the actual save
        serializer.save(m3u_account_id=m3u_account)
