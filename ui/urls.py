import os

from django.conf.urls import url
from django.views.generic import TemplateView

from ui.views import (
    AdminView, AddUserView, ChangeCustomerEmailView, CSVView,
    NewPassView, SendAdminCustomerEmailView, SendCustomerEmailView,
    SoftDeleteWinView, ExportWinsCSVView, AdminUploadCSVView)
from users.views import LoginView, LogoutView
from wins.views import (
    ConfirmationView, EditWinView, LockedWinTemplateView, MyWinsView,
    NewWinView, NewWinYearView, WinCompleteView, WinTemplateView, WinView
)

urlpatterns = [

    url(
        r"^$",
        MyWinsView.as_view(),
        name="index",
    ),

    url(
        r"^wins/new/$",
        NewWinView.as_view(),
        name="new-win",
    ),

    url(
        r"^wins/new/(?P<year>\d{4})/$",
        NewWinYearView.as_view(),
        name="new-win-year",
    ),

    # view/edit/complete a win
    url(
        r"^wins/(?P<win_id>[a-z0-9\-]{36})/$",
        WinView.as_view(),
        name="win-details"
    ),
    url(
        r"^wins/(?P<win_id>[a-z0-9\-]{36})/edit/$",
        EditWinView.as_view(),
        name="win-edit"
    ),
    url(
        r"^wins/(?P<win_id>[a-z0-9\-]{36})/complete/$",
        WinCompleteView.as_view(),
        name="win-complete"
    ),

    # success pages after creating/editing/completing a win
    url(
        r"^wins/(?P<win_id>[a-z0-9\-]{36})/new-success/$",
        WinTemplateView.as_view(template_name="wins/win-new-success.html"),
        name="new-win-success"
    ),
    url(
        r"^wins/(?P<win_id>[a-z0-9\-]{36})/edit-success/$",
        WinTemplateView.as_view(template_name="wins/win-edit-success.html"),
        name="edit-win-success"
    ),
    url(
        r"^wins/(?P<win_id>[a-z0-9\-]{36})/complete-success/$",
        WinTemplateView.as_view(
            template_name="wins/win-complete-success.html",
        ),
        name="complete-win-success"
    ),

    url(
        r"^wins/(?P<win_id>[a-z0-9\-]{36})/locked/$",
        LockedWinTemplateView.as_view(template_name="wins/win-edit-locked.html"),
        name="edit-win-locked"
    ),


    # review a win
    url(
        r"^wins/review/(?P<win_id>[a-z0-9\-]{36})/$",
        ConfirmationView.as_view(),
        name="responses"
    ),
    url(
        r"^wins/review/thanks/$",
        TemplateView.as_view(template_name="wins/confirmation-thanks.html"),
        name="confirmation-thanks"
    ),
    url(
        r"^wins/review/sample/$",
        ConfirmationView.as_view(),
        name="response_sample"
    ),

    url(
        r"^accounts/login/$",
        LoginView.as_view(),
        name="login",
    ),
    url(
        r"^accounts/logout/$",
        LogoutView.as_view(),
        name="logout",
    ),

    url(r"^admin$", AdminView.as_view(), name="admin-index"),
    url(r"^add-user$", AddUserView.as_view(), name="add-user"),
    url(r"^new-password$", NewPassView.as_view(), name="new-password"),
    url(r"^send-customer-email$", SendCustomerEmailView.as_view(),
        name="send-customer-email"),
    url(r"^send-admin-customer-email$", SendAdminCustomerEmailView.as_view(),
        name="send-admin-customer-email"),
    url(r"^change-customer-email$", ChangeCustomerEmailView.as_view(),
        name="change-customer-email"),
    url(r"^delete$", SoftDeleteWinView.as_view(),
        name="soft-delete"),
    url(r"^csv-upload$", AdminUploadCSVView.as_view(),
        name="csv-upload"),

]

csv_secret = os.getenv("CSV_SECRET")
if csv_secret:
    csv_url = url(r"^{}/".format(csv_secret), CSVView.as_view(), name="csv")
    urlpatterns = [csv_url] + urlpatterns

csv_fy_wins_secret = os.getenv("CSV_FY_WINS_SECRET")
if csv_fy_wins_secret:
    csv_fy_wins_url = url(r"^{}/".format(csv_fy_wins_secret), ExportWinsCSVView.as_view(), name="csv_wins")
    urlpatterns = [csv_fy_wins_url] + urlpatterns
