from django.conf import settings


def handy(request):
    return {
        "user": request.user,
        "FEEDBACK_EMAIL": settings.FEEDBACK_ADDRESS,
        "ANALYTICS_ID": settings.ANALYTICS_ID,
        "ALLOWED_YEARS": settings.ALLOWED_YEARS
    }
