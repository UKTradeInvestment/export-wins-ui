import datetime
from io import TextIOWrapper
from tempfile import TemporaryFile

import sys

import _csv
from boto3.exceptions import Boto3Error
from botocore.exceptions import ClientError
from django.conf import settings
from django.http import HttpResponse, HttpResponseForbidden, StreamingHttpResponse
from django.shortcuts import render
from django.utils.timezone import now
from django.views.generic import TemplateView, View

from alice.braces import LoginRequiredMixin
from alice.helpers import rabbit
from defusedcsv import csv
import boto3
from raven.contrib.django.raven_compat.models import client as sentry



ERROR_500_TEXT = "Server error, please try again or contact support"


class CSVView(LoginRequiredMixin, View):
    """ Get Zip of CSVs of current data from Data server """

    def get(self, request):
        data_response = rabbit.get(settings.CSV_AP, request=request, stream=True)
        today_date = datetime.datetime.utcnow().strftime('%Y-%m-%d')
        filename = 'ew-data-{}.zip'.format(today_date)
        data_iter = data_response.iter_content(8192)
        resp = StreamingHttpResponse(data_iter, content_type='application/zip')
        resp['Content-Disposition'] = 'attachment; filename=' + filename
        return resp


class ExportWinsCSVView(LoginRequiredMixin, View):
    """ Get CSV of current FY export wins data from Data server """

    def get(self, request):
        data_response = rabbit.get(settings.EW_CSV_AP, request=request)
        today = datetime.datetime.utcnow()
        today_str = today.strftime('%Y-%m-%d')
        if today.month < 4:
            fy = '{}-{}'.format(today.year-1, today.year)  
        else:
            fy = '{}-{}'.format(today.year, today.year+1)
        filename = 'ew-{}-wins-{}.csv'.format(fy, today_str)
        resp = HttpResponse(data_response.content, content_type='text/csv')
        resp['Content-Disposition'] = 'attachment; filename=' + filename
        return resp


class StaffRequiredMixin(object):

    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_staff:
            return HttpResponseForbidden()
        return super().dispatch(request, *args, **kwargs)


class BaseAdminView(LoginRequiredMixin, StaffRequiredMixin, TemplateView):

    def _admin_post(self):
        """ POST an admin change and handle result """

        result = rabbit.post(
            self.endpoint,
            request=self.request,
            data=self.request.POST,
        )
        if result.status_code == 500:
            return {
                'error': ERROR_500_TEXT
            }
        elif result.status_code != 201:
            error_data = result.json()
            return {'error': error_data['error']}
        else:
            return {'success': True}

    def post(self, *args, **kwargs):
        self.context = self.request.POST.dict()
        result = self._admin_post()
        self.context.update(result)
        return render(self.request, self.template_name, self.context)


class AdminView(BaseAdminView):
    template_name = 'ui/admin/index.html'


class AddUserView(BaseAdminView):
    """ Enter an email address, adds the user and sends them password email """

    endpoint = settings.ADD_USER_AP
    template_name = 'ui/admin/add-user.html'


class NewPassView(BaseAdminView):
    """ Enter an email address, sends them new password email """

    endpoint = settings.NEW_PASSWORD_AP
    template_name = 'ui/admin/new-password.html'


class SendCustomerEmailView(BaseAdminView):
    """ Enter Win ID, send email to customer and officer """

    endpoint = settings.SEND_CUSTOMER_EMAIL_AP
    template_name = 'ui/admin/send-customer-email.html'


class SendAdminCustomerEmailView(BaseAdminView):
    """ Enter Win ID, send customer email to admin """

    endpoint = settings.SEND_ADMIN_CUSTOMER_EMAIL_AP
    template_name = 'ui/admin/send-admin-customer-email.html'


class ChangeCustomerEmailView(BaseAdminView):
    """ Enter Win ID & email address, change's customer address & emails """

    endpoint = settings.CHANGE_CUSTOMER_EMAIL_AP
    template_name = 'ui/admin/change-customer-email.html'


class SoftDeleteWinView(BaseAdminView):
    """ Enter Win ID, gets marked deleted in DB """

    endpoint = settings.SOFT_DELETE_AP
    template_name = 'ui/admin/soft-delete.html'


def sanitize_csv(csvfile, out):
    """
    protects csv from formula injection attacks
    :param csvfile: file like object containing a csv
    :param out: file like object to write the sanitized csv into
    """
    r = csv.reader(csvfile)
    w = csv.writer(out)
    for row in r:
        w.writerow(row)
    out.seek(0)


def upload_to_s3(file_):
    """
    upload a file like object to s3

    :param file_: file to upload
    :return: full s3uri
    """
    now_ = now()

    file_name = 'export-wins/{year}/{month}/{timestamp}.csv'.format(
        year=now_.year,
        month=now_.month,
        timestamp=now_.isoformat()
    )

    s3 = boto3.client(
        's3',
        aws_access_key_id=settings.CSV_UPLOAD_AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.CSV_UPLOAD_AWS_SECRET_ACCESS_KEY,
        region_name=settings.CSV_AWS_REGION
    )
    s3.upload_fileobj(
        file_,
        settings.CSV_UPLOAD_AWS_BUCKET,
        file_name,
        ExtraArgs={'ServerSideEncryption': "AES256"}
    )
    return 's3://{bucket_name}/{key}'.format(
        bucket_name=settings.CSV_UPLOAD_AWS_BUCKET,
        key=file_name
    )


def check_content_type(content_type):
    valid_content_types = {
        'application/csv',
        'application/x-csv',
        'text/csv',
        'text/comma-separated-values',
        'text/x-comma-separated-values',
        'text/plain',
        'application/vnd.ms-excel'
    }
    if content_type in valid_content_types:
        return True

    if content_type.startswith('text/'):
        return True

    return False


class AdminUploadCSVView(BaseAdminView):

    endpoint = settings.CSV_UPLOAD_NOTIFY_AP
    template_name = 'ui/admin/csv-upload.html'

    def _admin_post(self):
        result = rabbit.post(
            self.endpoint,
            request=self.request,
            data={'path': self.context['file_name']},
        )
        if not result.ok:
            self.context.update({'success': False, 'error': ERROR_500_TEXT})

    def get_context_data(self, **kwargs):
        context = super(AdminUploadCSVView, self).get_context_data(**kwargs)
        context.update({'enctype': 'multipart/form-data'})
        return context

    def post(self, *args, **kwargs):
        self.context = self.get_context_data()
        self.context.update(**self.request.POST.dict())

        if 'csvfile' in self.request.FILES:
            uploaded = self.request.FILES['csvfile']
            encoding = settings.CSV_UPLOAD_DEFAULT_ENCODING
            self.context.update({
                'file_size': uploaded.size,
                'orig_file_name': uploaded.name,
                'content_type': uploaded.content_type,
                'content_params': self.request.content_params,
                'encoding': self.request.encoding,
            })
            csvfile = TextIOWrapper(
                uploaded.file, encoding=encoding)
            if check_content_type(uploaded.content_type):
                with TemporaryFile(mode='w+', encoding=encoding) as o:
                    try:
                        sanitize_csv(csvfile, o)
                    except (UnicodeDecodeError, _csv.Error) as ude:
                        sentry.captureException(exc_info=sys.exc_info(), request=self.request)
                        self.context.update(
                            {'success': False, 'error': 'Uploaded file is not a valid .csv file. '
                                                        'Please ensure it is encoded as Windows-1252.'})
                        o.close()
                        return render(self.request, self.template_name, self.context)

                    try:
                        result = upload_to_s3(o.buffer)
                        self.context.update(
                            {'success': True, 'file_name': result})
                        self._admin_post()
                    except (Boto3Error, ClientError):
                        sentry.captureException(exc_info=sys.exc_info(), request=self.request)
                        o.close()
                        self.context.update({
                            'success': False,
                            'error': "Couldn't upload file to S3. Please try again."}
                        )
            else:
                self.context.update(
                    {'success': False, 'error': 'Uploaded file must be in .csv format.'})
                sentry.capture('Message', message="CSV upload failed", request=self.request, extra=self.context)
        else:
            self.context.update(
                {'success': False, 'error': 'A file is required.'})

        return render(self.request, self.template_name, self.context)
