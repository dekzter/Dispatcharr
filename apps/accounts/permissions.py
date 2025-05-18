from rest_framework.permissions import BasePermission, IsAuthenticated
from .models import User


class ReadOnly(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.user_level >= User.UserLevel.READ_ONLY


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.user_level >= 10


class IsOwnerOfObject(BasePermission):
    def has_object_permission(self, request, view, obj):
        is_admin = IsAdmin().has_permission(request, view)
        is_owner = request.user in obj.users.all()

        return is_admin or is_owner


permission_classes_by_action = {
    "list": [ReadOnly],
    "create": [IsAdmin],
    "retrieve": [ReadOnly],
    "update": [IsAdmin],
    "partial_update": [IsAdmin],
    "destroy": [IsAdmin],
}

permission_classes_by_method = {
    "GET": [ReadOnly],
    "POST": [IsAdmin],
    "PATCH": [IsAdmin],
    "PUT": [IsAdmin],
    "DELETE": [IsAdmin],
}
