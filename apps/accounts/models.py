# apps/accounts/models.py
from django.db import models
from django.contrib.auth.models import AbstractUser, Permission


class User(AbstractUser):
    """
    Custom user model for Dispatcharr.
    Inherits from Django's AbstractUser to add additional fields if needed.
    """

    class UserLevel(models.IntegerChoices):
        STREAMER = 0, "Streamer"
        READ_ONLY = 1, "ReadOnly"
        ADMIN = 10, "Admin"

    avatar_config = models.JSONField(default=dict, blank=True, null=True)
    channel_profiles = models.ManyToManyField(
        "dispatcharr_channels.ChannelProfile",
        blank=True,
        related_name="users",
    )
    user_level = models.IntegerField(default=UserLevel.STREAMER)

    def __str__(self):
        return self.username

    def get_groups(self):
        """
        Returns the groups (roles) the user belongs to.
        """
        return self.groups.all()

    def get_permissions(self):
        """
        Returns the permissions assigned to the user and their groups.
        """
        return self.user_permissions.all() | Permission.objects.filter(group__user=self)
