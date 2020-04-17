import responses
from django.conf import settings
from django.test import Client, TestCase
from django.urls import reverse


class LoginTest(TestCase):

    def setUp(self):
        self.client = Client()
        self.login_url = reverse('login')

    def test_login_page(self):
        response = self.client.get(self.login_url)
        self.assertContains(response, 'Email')
        self.assertContains(response, 'Password')

    def _login(self, url=None):
        if not url:
            url = self.login_url
        return self.client.post(
            url,
            {
                'email': 'email@example.com',
                'password': 'password',
            },
            follow=True,
        )

    @responses.activate
    def test_login_post_invalid_credentials(self):
        responses.add(responses.POST, settings.LOGIN_AP, json={'non_field_errors': ['Unable to log in']}, status=400,
                      content_type='application/json',
                      adding_headers={'set-cookie': 'sessionid=1234;expires=Fri, 01-Jan-2055 00:00:00 GMT'})
        responses.add(responses.GET, settings.IS_LOGGED_IN_AP, json={}, status=200,
                      content_type='application/json')
        responses.add(responses.GET, 'http://127.0.0.1:8000/wins/?user__id=None', json={'results': []}, status=200,
                      content_type='application/json')
        response = self._login()
        self.assertContains(response, 'Unable to log in')

    @responses.activate
    def test_login_post_valid_credentials(self):
        responses.add(responses.POST, settings.LOGIN_AP, json={'token': 'lol does not matter'}, status=200,
                      content_type='application/json',
                      adding_headers={'set-cookie': 'sessionid=1234;expires=Fri, 01-Jan-2055 00:00:00 GMT'})
        responses.add(responses.GET, settings.IS_LOGGED_IN_AP, json='true', status=200,
                      content_type='application/json')
        responses.add(responses.GET, 'http://127.0.0.1:8000/wins/?user__id=None', json={'results': []}, status=200,
                      content_type='application/json')
        response = self._login()
        self.assertRedirects(response, '/')
        self.assertContains(response, 'Create new win')

    @responses.activate
    def test_login_post_valid_credentials_bad_redirect(self):
        responses.add(responses.POST, settings.LOGIN_AP + '?next=http://example.com', json={}, status=200,
                      content_type='application/json',
                      adding_headers={'set-cookie': 'sessionid=1234;expires=Fri, 01-Jan-2055 00:00:00 GMT'})
        responses.add(responses.GET, settings.IS_LOGGED_IN_AP, json='true', status=200,
                      content_type='application/json')
        responses.add(responses.GET, 'http://127.0.0.1:8000/wins/?user__id=None', json={'results': []}, status=200,
                      content_type='application/json')
        response = self._login(settings.LOGIN_AP + '?next=http://example.com')
        self.assertEqual(response.status_code, 404)

    @responses.activate
    def test_login_bad_rabbit_no_json(self):
        responses.add(responses.POST, settings.LOGIN_AP, status=500, content_type='application/json',
                      json={'non_field_errors': ['Unable to log in with provided credentials.']})
        response = self._login()
        self.assertContains(response, 'Unable to log in with provided credentials.')

    @responses.activate
    def test_login_bad_rabbit_no_return(self):
        responses.add(responses.POST, settings.LOGIN_AP, json={}, status=500, content_type='application/json')
        with self.assertRaises(Exception):
            self._login()
