#!/usr/bin/env python3
"""Static safety checks for the isolated connection-hub preview."""
from html.parser import HTMLParser
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
class Parse(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.scripts = []
        self.links = []
        self.inputs = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            assert a["id"] not in self.ids, f"Duplicate ID: {a['id']}"
            self.ids.add(a["id"])
        if tag == "script": self.scripts.append(a.get("src"))
        if tag == "a": self.links.append(a.get("href", ""))
        if tag == "input": self.inputs.append(a)

class PreviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = (ROOT / "preview/index.html").read_text(encoding="utf-8")
        cls.parser = Parse()
        cls.parser.feed(cls.html)
    def test_preview_uses_kavoltri_brand_only(self):
        for page in ("index.html", "legal.html"):
            html = (ROOT / "preview" / page).read_text(encoding="utf-8")
            self.assertIn("KAVOLTRI", html)
            self.assertNotRegex(html, re.compile(r"<title>[^<]*flexi[\\s-]?rent", re.IGNORECASE))
    def test_demo_is_explicit(self):
        self.assertIn("TEST SITE ONLY", self.html)
        self.assertIn("preview_published", self.html)
    def test_no_live_payment_processing(self):
        self.assertNotIn("checkout.stripe.com", self.html)
        self.assertNotIn("js.stripe.com", self.html)
        self.assertIn("KAVOLTRI", self.html)
        self.assertIn("kavoltri_conversations", self.html)
        self.assertIn("supabase.co", self.html)
        self.assertEqual(self.parser.scripts, [None])
    def test_accessible_forms(self):
        for required in ["reportDemo", "reportReason", "reportDetails", "reportAcknowledged", "reportResult", "inquiryDemo", "demoSubject", "demoMessage", "demoAcknowledged", "inquiryResult", "checkDialog", "dialogTitle", "checkForm", "checks", "result", "ownerButton", "closeDialog"]:
            self.assertIn(required, self.parser.ids)
        self.assertIn('input.required=true', self.html)
        self.assertIn('textContent=statement', self.html)
    def test_demo_report_is_not_transmitted(self):
        self.assertIn("Sample report validated locally. No report was filed or saved.", self.html)
        for reason in ("fraud", "unsafe", "harassment", "misleading", "other"):
            self.assertIn(f'value="{reason}"', self.html)
    def test_demo_inquiry_is_not_transmitted(self):
        self.assertIn("Sample inquiry validated locally. No message was sent or stored.", self.html)
        self.assertIn('minlength="10" maxlength="2000"', self.html)
        self.assertIn('minlength="3" maxlength="120"', self.html)
    def test_legal_links_exist(self):
        self.assertTrue((ROOT / "preview/legal.html").exists())
        self.assertTrue(any(href == "legal.html" for href in self.parser.links))
    def test_no_deceptive_booking(self):
        self.assertIn("not a reservation", self.html)
        self.assertIn("not a booking", self.html.lower())
        self.assertIn("payments", self.html.lower())

if __name__ == "__main__":
    unittest.main()
