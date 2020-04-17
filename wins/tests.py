import datetime
from unittest import mock

import responses
from django.conf import settings
from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone

mock.patch('alice.metaclasses.rabbit', spec=True).start()


class ConfirmationFormTest(TestCase):
    def setUp(self):
        self.client = Client()
        self.login_url = reverse('login')

    def _login(self):
        responses.add(responses.POST, settings.LOGIN_AP, json={'token': 'lol does not matter'}, status=200,
                      content_type='application/json',
                      adding_headers={'set-cookie': 'sessionid=1234;expires=Fri, 01-Jan-2055 00:00:00 GMT'})
        responses.add(responses.GET, settings.IS_LOGGED_IN_AP, json='true', status=200,
                      content_type='application/json')
        return self.client.post(
            self.login_url,
            {
                'email': 'email@example.com',
                'password': 'password',
            },
            follow=True,
        )

    def _add_common_resp(self):
        responses.add(responses.GET, 'http://127.0.0.1:8000/wins/?user__id=None', json={'results': []}, status=200,
                      content_type='application/json')
        responses.add(responses.GET, 'http://127.0.0.1:8000/wins/review/123456789012345678901234567890123456/',
                      json={'id': '123456789012345678901234567890123456', 'date': '2012-01-19 17:21:00 UTC'},
                      status=200,
                      content_type='application/json')

    @responses.activate
    def test_fails_with_bad_win_pk(self):
        self._add_common_resp()
        responses.add(responses.GET, 'http://127.0.0.1:8000/limited-wins/123456789012345678901234567890123456/',
                      json={}, status=404, content_type='application/json')
        self._login()
        resp = self.client.get(reverse('responses', kwargs={'win_id': '123456789012345678901234567890123456'}))
        self.assertNotContains(resp, "Please review this information")
        self.assertContains(resp, "Sorry, this record is not available")

    @responses.activate
    def test_fails_with_old_win(self):
        self._add_common_resp()
        responses.add(responses.GET, 'http://127.0.0.1:8000/limited-wins/123456789012345678901234567890123456/',
                      json={'created': str(timezone.now() - datetime.timedelta(weeks=53))},
                      status=200, content_type='application/json')
        self._login()
        resp = self.client.get(reverse('responses', kwargs={'win_id': '123456789012345678901234567890123456'}))
        self.assertNotContains(resp, 'Please review this information')
        self.assertContains(resp, 'Sorry, this record is no longer available')

    @responses.activate
    def test_fails_with_confirmed_win(self):
        responses.add(responses.GET, 'http://127.0.0.1:8000/wins/?user__id=None', json={'results': []}, status=200,
                      content_type='application/json')
        responses.add(responses.GET, 'http://127.0.0.1:8000/details/123456789012345678901234567890123456/',
                      json={'id': '123456789012345678901234567890123456',
                            'created': str(timezone.now()),
                            'sent': ['2012-01-19 17:21:00 UTC'], 'date': '2012-01-19 17:21:00 UTC'},
                      status=200,
                      content_type='application/json')
        responses.add(responses.GET, 'http://127.0.0.1:8000/limited-wins/123456789012345678901234567890123456/',
                      json={'id': '123456789012345678901234567890123456',
                            'created': str(timezone.now()),
                            'sent': ['2012-01-19 17:21:00 UTC'],
                            'date': '2012-01-19 17:21:00 UTC'}, status=200, content_type='application/json')
        responses.add(responses.GET, 'http://127.0.0.1:8000/confirmations/?win=123456789012345678901234567890123456',
                      json={'count': 1}, status=200, content_type='application/json')
        self._login()
        resp = self.client.get(reverse('responses', kwargs={'win_id': '123456789012345678901234567890123456'}))
        self.assertNotContains(resp, "Please review this information")
        self.assertContains(resp, 'Sorry, this confirmation was already completed.')

    # @patch('wins.views.rabbit.get')
    # def test_form_shown_unconfirmed_win(self, mock_rabbit_get):
    #     created_dt = timezone.now()
    #     # bit hacky - using same mock for win, confirmation and schema
    #     mock_rabbit_get.return_value = MagicMock(
    #         status_code=200,
    #         json=Mock(return_value={
    #                     'created': str(created_dt),
    #                     'id': 'fake-pk',
    #                     'count': 0,
    #                     }
    #             ),
    #     )
    #     resp = self.client.get(reverse('responses', kwargs={'pk': 'fake-pk'}))
    #     self.assertNotContains(resp, "Sorry, this record")
    #     self.assertContains(resp, "Below is a summary of your recent Export Win")
