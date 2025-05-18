from django.urls import path, re_path, include
from .views import generate_m3u, generate_epg, xc_get
from core.views import stream_view

app_name = 'output'

urlpatterns = [
    # Allow `/m3u`, `/m3u/`, `/m3u/profile_name`, and `/m3u/profile_name/`
    re_path(r'^m3u(?:/(?P<profile_name>[^/]+))?/?$', generate_m3u, name='generate_m3u'),

    # Allow `/epg`, `/epg/`, `/epg/profile_name`, and `/epg/profile_name/`
    re_path(r'^epg(?:/(?P<profile_name>[^/]+))?/?$', generate_epg, name='generate_epg'),

    # Allow both `/stream/<int:stream_id>` and `/stream/<int:stream_id>/`
    re_path(r'^stream/(?P<channel_uuid>[0-9a-fA-F\-]+)/?$', stream_view, name='stream'),
]
