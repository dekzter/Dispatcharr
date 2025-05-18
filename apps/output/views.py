from django.http import HttpResponse, JsonResponse, Http404
from rest_framework.response import Response
from django.urls import reverse
from apps.channels.models import Channel, ChannelProfile, ChannelGroup
from apps.epg.models import ProgramData
from django.utils import timezone
from datetime import datetime, timedelta
import re
import html  # Add this import for XML escaping
from django.contrib.auth import authenticate
from tzlocal import get_localzone
import time
import json
from urllib.parse import urlparse


def generate_m3u(request, user):
    if user.user_level == 0:
        channel_profiles = user.channel_profiles.all()
        filters = {
            "channelprofilemembership__channel_profile__in": channel_profiles,
            "channelprofilemembership__enabled": True,
            "user_level__lte": user.user_level,
        }

        channels = Channel.objects.filter(**filters).order_by("channel_number")
    else:
        channels = Channel.objects.filter(user_level__lte=user.user_level).order_by(
            "channel_number"
        )

    m3u_content = "#EXTM3U\n"
    for channel in channels:
        group_title = channel.channel_group.name if channel.channel_group else "Default"

        # Format channel number as integer if it has no decimal component
        if channel.channel_number is not None:
            if channel.channel_number == int(channel.channel_number):
                formatted_channel_number = int(channel.channel_number)
            else:
                formatted_channel_number = channel.channel_number
        else:
            formatted_channel_number = ""

        # Use formatted channel number for tvg_id to ensure proper matching with EPG
        tvg_id = (
            str(formatted_channel_number)
            if formatted_channel_number != ""
            else str(channel.id)
        )
        tvg_name = channel.name

        tvg_logo = ""
        if channel.logo:
            tvg_logo = request.build_absolute_uri(
                reverse("api:channels:logo-cache", args=[channel.logo.id])
            )

        # create possible gracenote id insertion
        tvc_guide_stationid = ""
        if channel.tvc_guide_stationid:
            tvc_guide_stationid = (
                f'tvc-guide-stationid="{channel.tvc_guide_stationid}" '
            )

        extinf_line = (
            f'#EXTINF:-1 tvg-id="{tvg_id}" tvg-name="{tvg_name}" tvg-logo="{tvg_logo}" '
            f'tvg-chno="{formatted_channel_number}" {tvc_guide_stationid}group-title="{group_title}",{channel.name}\n'
        )

        base_url = request.build_absolute_uri("/")[:-1]
        stream_url = f"{base_url}/proxy/ts/stream/{channel.uuid}"

        # stream_url = request.build_absolute_uri(reverse('output:stream', args=[channel.id]))
        m3u_content += extinf_line + stream_url + "\n"

    response = HttpResponse(m3u_content, content_type="audio/x-mpegurl")
    response["Content-Disposition"] = 'attachment; filename="channels.m3u"'
    return response


def generate_dummy_epg(
    channel_id, channel_name, xml_lines=None, num_days=1, program_length_hours=4
):
    """
    Generate dummy EPG programs for channels without EPG data.
    Creates program blocks for a specified number of days.

    Args:
        channel_id: The channel ID to use in the program entries
        channel_name: The name of the channel to use in program titles
        xml_lines: Optional list to append lines to, otherwise returns new list
        num_days: Number of days to generate EPG data for (default: 1)
        program_length_hours: Length of each program block in hours (default: 4)

    Returns:
        List of XML lines for the dummy EPG entries
    """
    if xml_lines is None:
        xml_lines = []

    # Get current time rounded to hour
    now = timezone.now()
    now = now.replace(minute=0, second=0, microsecond=0)

    # Humorous program descriptions based on time of day
    time_descriptions = {
        (0, 4): [
            f"Late Night with {channel_name} - Where insomniacs unite!",
            f"The 'Why Am I Still Awake?' Show on {channel_name}",
            f"Counting Sheep - A {channel_name} production for the sleepless",
        ],
        (4, 8): [
            f"Dawn Patrol - Rise and shine with {channel_name}!",
            f"Early Bird Special - Coffee not included",
            f"Morning Zombies - Before coffee viewing on {channel_name}",
        ],
        (8, 12): [
            f"Mid-Morning Meetings - Pretend you're paying attention while watching {channel_name}",
            f"The 'I Should Be Working' Hour on {channel_name}",
            f"Productivity Killer - {channel_name}'s daytime programming",
        ],
        (12, 16): [
            f"Lunchtime Laziness with {channel_name}",
            f"The Afternoon Slump - Brought to you by {channel_name}",
            f"Post-Lunch Food Coma Theater on {channel_name}",
        ],
        (16, 20): [
            f"Rush Hour - {channel_name}'s alternative to traffic",
            f"The 'What's For Dinner?' Debate on {channel_name}",
            f"Evening Escapism - {channel_name}'s remedy for reality",
        ],
        (20, 24): [
            f"Prime Time Placeholder - {channel_name}'s finest not-programming",
            f"The 'Netflix Was Too Complicated' Show on {channel_name}",
            f"Family Argument Avoider - Courtesy of {channel_name}",
        ],
    }

    # Create programs for each day
    for day in range(num_days):
        day_start = now + timedelta(days=day)

        # Create programs with specified length throughout the day
        for hour_offset in range(0, 24, program_length_hours):
            # Calculate program start and end times
            start_time = day_start + timedelta(hours=hour_offset)
            end_time = start_time + timedelta(hours=program_length_hours)

            # Get the hour for selecting a description
            hour = start_time.hour

            # Find the appropriate time slot for description
            for time_range, descriptions in time_descriptions.items():
                start_range, end_range = time_range
                if start_range <= hour < end_range:
                    # Pick a description using the sum of the hour and day as seed
                    # This makes it somewhat random but consistent for the same timeslot
                    description = descriptions[(hour + day) % len(descriptions)]
                    break
            else:
                # Fallback description if somehow no range matches
                description = f"Placeholder program for {channel_name} - EPG data went on vacation"

            # Format times in XMLTV format
            start_str = start_time.strftime("%Y%m%d%H%M%S %z")
            stop_str = end_time.strftime("%Y%m%d%H%M%S %z")

            # Create program entry with escaped channel name
            xml_lines.append(
                f'  <programme start="{start_str}" stop="{stop_str}" channel="{channel_id}">'
            )
            xml_lines.append(f"    <title>{html.escape(channel_name)}</title>")
            xml_lines.append(f"    <desc>{html.escape(description)}</desc>")
            xml_lines.append(f"  </programme>")

    return xml_lines


def generate_epg(request, user):
    """
    Dynamically generate an XMLTV (EPG) file using the new EPGData/ProgramData models.
    Since the EPG data is stored independently of Channels, we group programmes
    by their associated EPGData record.
    This version does not filter by time, so it includes the entire EPG saved in the DB.
    """
    xml_lines = []
    xml_lines.append('<?xml version="1.0" encoding="UTF-8"?>')
    xml_lines.append(
        '<tv generator-info-name="Dispatcharr" generator-info-url="https://github.com/Dispatcharr/Dispatcharr">'
    )

    if user.user_level == 0:
        channel_profiles = user.channel_profiles.all()
        filters = {
            "channelprofilemembership__channel_profile__in": channel_profiles,
            "channelprofilemembership__enabled": True,
            "user_level__lte": user.user_level,
        }

        channels = Channel.objects.filter(**filters).order_by("channel_number")
    else:
        channels = Channel.objects.filter(user_level__lte=user.user_level).order_by(
            "channel_number"
        )

    # Retrieve all active channels
    for channel in channels:
        # Format channel number as integer if it has no decimal component - same as M3U generation
        if channel.channel_number is not None:
            if channel.channel_number == int(channel.channel_number):
                formatted_channel_number = str(int(channel.channel_number))
            else:
                formatted_channel_number = str(channel.channel_number)
        else:
            formatted_channel_number = str(channel.id)

        display_name = channel.epg_data.name if channel.epg_data else channel.name
        xml_lines.append(f'  <channel id="{formatted_channel_number}">')
        xml_lines.append(
            f"    <display-name>{html.escape(display_name)}</display-name>"
        )

        # Add channel logo if available
        if channel.logo:
            logo_url = request.build_absolute_uri(
                reverse("api:channels:logo-cache", args=[channel.logo.id])
            )
            xml_lines.append(f'    <icon src="{html.escape(logo_url)}" />')

        xml_lines.append("  </channel>")

    for channel in channels:
        # Use the same formatting for channel ID in program entries
        if channel.channel_number is not None:
            if channel.channel_number == int(channel.channel_number):
                formatted_channel_number = str(int(channel.channel_number))
            else:
                formatted_channel_number = str(channel.channel_number)
        else:
            formatted_channel_number = str(channel.id)

        display_name = channel.epg_data.name if channel.epg_data else channel.name
        if not channel.epg_data:
            # Use the enhanced dummy EPG generation function with defaults
            # These values could be made configurable via settings or request parameters
            num_days = 1  # Default to 1 days of dummy EPG data
            program_length_hours = 4  # Default to 4-hour program blocks
            generate_dummy_epg(
                formatted_channel_number,
                display_name,
                xml_lines,
                num_days=num_days,
                program_length_hours=program_length_hours,
            )
        else:
            programs = channel.epg_data.programs.all()
            for prog in programs:
                start_str = prog.start_time.strftime("%Y%m%d%H%M%S %z")
                stop_str = prog.end_time.strftime("%Y%m%d%H%M%S %z")
                xml_lines.append(
                    f'  <programme start="{start_str}" stop="{stop_str}" channel="{formatted_channel_number}">'
                )
                xml_lines.append(f"    <title>{html.escape(prog.title)}</title>")

                # Add subtitle if available
                if prog.sub_title:
                    xml_lines.append(
                        f"    <sub-title>{html.escape(prog.sub_title)}</sub-title>"
                    )

                # Add description if available
                if prog.description:
                    xml_lines.append(
                        f"    <desc>{html.escape(prog.description)}</desc>"
                    )

                # Process custom properties if available
                if prog.custom_properties:
                    try:
                        import json

                        custom_data = json.loads(prog.custom_properties)

                        # Add categories if available
                        if "categories" in custom_data and custom_data["categories"]:
                            for category in custom_data["categories"]:
                                xml_lines.append(
                                    f"    <category>{html.escape(category)}</category>"
                                )

                        # Handle episode numbering - multiple formats supported
                        # Standard episode number if available
                        if "episode" in custom_data:
                            xml_lines.append(
                                f'    <episode-num system="onscreen">E{custom_data["episode"]}</episode-num>'
                            )

                        # Handle onscreen episode format (like S06E128)
                        if "onscreen_episode" in custom_data:
                            xml_lines.append(
                                f'    <episode-num system="onscreen">{html.escape(custom_data["onscreen_episode"])}</episode-num>'
                            )

                        # Add season and episode numbers in xmltv_ns format if available
                        if "season" in custom_data and "episode" in custom_data:
                            season = (
                                int(custom_data["season"]) - 1
                                if str(custom_data["season"]).isdigit()
                                else 0
                            )
                            episode = (
                                int(custom_data["episode"]) - 1
                                if str(custom_data["episode"]).isdigit()
                                else 0
                            )
                            xml_lines.append(
                                f'    <episode-num system="xmltv_ns">{season}.{episode}.</episode-num>'
                            )

                        # Add rating if available
                        if "rating" in custom_data:
                            rating_system = custom_data.get(
                                "rating_system", "TV Parental Guidelines"
                            )
                            xml_lines.append(
                                f'    <rating system="{html.escape(rating_system)}">'
                            )
                            xml_lines.append(
                                f'      <value>{html.escape(custom_data["rating"])}</value>'
                            )
                            xml_lines.append(f"    </rating>")

                        # Add actors/directors/writers if available
                        if "credits" in custom_data:
                            xml_lines.append(f"    <credits>")
                            for role, people in custom_data["credits"].items():
                                if isinstance(people, list):
                                    for person in people:
                                        xml_lines.append(
                                            f"      <{role}>{html.escape(person)}</{role}>"
                                        )
                                else:
                                    xml_lines.append(
                                        f"      <{role}>{html.escape(people)}</{role}>"
                                    )
                            xml_lines.append(f"    </credits>")

                        # Add program date/year if available
                        if "year" in custom_data:
                            xml_lines.append(
                                f'    <date>{html.escape(custom_data["year"])}</date>'
                            )

                        # Add country if available
                        if "country" in custom_data:
                            xml_lines.append(
                                f'    <country>{html.escape(custom_data["country"])}</country>'
                            )

                        # Add icon if available
                        if "icon" in custom_data:
                            xml_lines.append(
                                f'    <icon src="{html.escape(custom_data["icon"])}" />'
                            )

                        # Add special flags as proper tags
                        if custom_data.get("previously_shown", False):
                            xml_lines.append(f"    <previously-shown />")

                        if custom_data.get("premiere", False):
                            xml_lines.append(f"    <premiere />")

                        if custom_data.get("new", False):
                            xml_lines.append(f"    <new />")

                    except Exception as e:
                        xml_lines.append(
                            f"    <!-- Error parsing custom properties: {html.escape(str(e))} -->"
                        )

                xml_lines.append("  </programme>")

    xml_lines.append("</tv>")
    xml_content = "\n".join(xml_lines)

    response = HttpResponse(xml_content, content_type="application/xml")
    response["Content-Disposition"] = 'attachment; filename="epg.xml"'
    return response


def xc_player_api(request):
    action = request.GET.get("action")
    username = request.GET.get("username")
    password = request.GET.get("password")

    if not username or not password:
        raise Http404()

    user = authenticate(
        username=request.GET.get("username"), password=request.GET.get("password")
    )

    if user is None:
        raise Http404()

    raw_host = request.get_host()
    if ":" in raw_host:
        hostname, port = raw_host.split(":", 1)
    else:
        hostname = raw_host
        port = "443" if request.is_secure() else "80"

    if not action:
        return JsonResponse(
            {
                "user_info": {
                    "username": username,
                    "password": password,
                    "message": "",
                    "auth": 1,
                    "status": "Active",
                    "exp_date": "1715062090",
                    "max_connections": "99",
                    "allowed_output_formats": [
                        "ts",
                    ],
                },
                "server_info": {
                    "url": hostname,
                    "server_protocol": request.scheme,
                    "port": port,
                    "timezone": get_localzone().key,
                    "timestamp_now": int(time.time()),
                    "time_now": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "process": True,
                },
            }
        )

    if action == "get_live_categories":
        return xc_get_live_categories(user)
    if action == "get_live_streams":
        return xc_get_live_streams(request, user, request.GET.get("category_id"))


def xc_get(request):
    action = request.GET.get("action")
    username = request.GET.get("username")
    password = request.GET.get("password")

    if not username or not password:
        raise Http404()

    user = authenticate(
        username=request.GET.get("username"), password=request.GET.get("password")
    )

    if user is None:
        raise Http404()

    if not action:
        return generate_m3u(request, user)


def xc_xmltv(request):
    username = request.GET.get("username")
    password = request.GET.get("password")

    if not username or not password:
        raise Http404()

    user = authenticate(
        username=request.GET.get("username"), password=request.GET.get("password")
    )

    if user is None:
        raise Http404()

    return generate_epg(request, user)


def xc_get_live_categories(user):
    response = []

    if user.user_level == 0:
        # Only get data from active profile
        channel_profiles = user.channel_profiles.all()
        print(channel_profiles)

        channel_groups = ChannelGroup.objects.filter(
            channels__channelprofilemembership__channel_profile__in=channel_profiles,
            channels__channelprofilemembership__enabled=True,
            channels__user_level=0,
        ).distinct()
    else:
        channel_groups = ChannelGroup.objects.filter(
            channels__isnull=False, channels__user_level__lte=user.user_level
        ).distinct()

    for group in channel_groups:
        response.append(
            {
                "category_id": group.id,
                "category_name": group.name,
                "parent_id": 0,
            }
        )

    return JsonResponse(response, safe=False)


def xc_get_live_streams(request, user, category_id=None):
    streams = []

    if user.user_level == 0:
        # Only get data from active profile
        channel_profiles = user.channel_profiles.all()
        filters = {
            "channelprofilemembership__channel_profile__in": channel_profiles,
            "channelprofilemembership__enabled": True,
            "user_level__lte": user.user_level,
        }

        if category_id is not None:
            filters["channel_group__id"] = category_id

        channels = Channel.objects.filter(**filters)
    else:
        if not category_id:
            channels = Channel.objects.filter(user_level__lte=user.user_level)
        else:
            channels = Channel.objects.filter(
                channel_group__id=category_id, user_level__lte=user.user_level
            )

    for channel in channels:
        streams.append(
            {
                "num": channel.channel_number,
                "name": channel.name,
                "stream_type": "live",
                "stream_id": channel.id,
                "stream_icon": (
                    None
                    if not channel.logo
                    else request.build_absolute_uri(
                        reverse("api:channels:logo-cache", args=[channel.logo.id])
                    )
                ),
                "epg_channel_id": channel.epg_data.tvg_id if channel.epg_data else "",
                "added": int(time.time()),  # @TODO: make this the actual created date
                "is_adult": 0,
                "category_id": channel.channel_group.id,
                "category_ids": [channel.channel_group.id],
                "custom_sid": None,
                "tv_archive": 0,
                "direct_source": "",
                "tv_archive_duration": 0,
            }
        )

    return JsonResponse(streams, safe=False)
