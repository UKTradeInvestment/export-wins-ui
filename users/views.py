from datetime import datetime

import jwt
from django.conf import settings
from django.utils.http import is_safe_url
from django.views.generic import FormView, RedirectView

from alice.helpers import rabbit
from .forms import LoginForm


def cookie_domain():
    # in production, we want to share cookies across exportwins subdomains
    if not settings.DEBUG and not settings.STAGING:
        return '.exportwins.service.trade.gov.uk'
    # otherwise None just uses whatever domain the page is loaded from
    return None


class LoginView(FormView):
    """ Login via data server and set JWT cookie

    When user put their details into the form, the form passes them to the data
    server, which creates and manages a session for the user.

    """

    form_class = LoginForm
    template_name = "users/login.html"

    def form_valid(self, form):
        response = FormView.form_valid(self, form)

        # After successful login, save dict of user data given by data server
        # API into JWT cookie. Also save session id of session from data
        # server, for use when making requests to data server via Rabbit.
        # Note UI server and admin server have different secrets and domains.
        jwt_val = jwt.encode(
            {
                "user": form.user,
                "session": form.session_cookie.value
            },
            settings.COOKIE_SECRET,
            'HS256'
        ).decode('utf-8')
        expires = datetime.fromtimestamp(form.session_cookie.expires)\
                          .strftime('%a, %d %b %Y %H:%M:%S')
        kwargs = {
            'value': jwt_val,
            'expires': expires,
            'secure': settings.SESSION_COOKIE_SECURE,
            'httponly': True,
            'domain': cookie_domain(),
        }

        response.set_cookie("alice", **kwargs)
        return response

    def get_success_url(self):
        redirect_to = self.request.GET.get("next")
        if redirect_to:
            if is_safe_url(url=redirect_to, allowed_hosts=self.request.get_host()):
                return redirect_to
        return "/"


class LogoutView(RedirectView):

    url = "/"

    def get(self, request, *args, **kwargs):
        rabbit.get(settings.LOGOUT_AP, request=request)  # Data server log out
        response = RedirectView.get(self, request, *args, **kwargs)
        response.delete_cookie("alice", domain=cookie_domain())
        return response
