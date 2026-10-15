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
    def test_demo_is_explicit(self):
        self.assertIn("TEST PREVIEW ONLY", self.html)
        self.assertIn("No data is submitted or saved", self.html)
    def test_no_live_backend_or_payment(self):
        for forbidden in ["supabase-config.js", "supabaseClient", "fetch(", "XMLHttpRequest", "localStorage", "sessionStorage", "stripe.com", "checkout.stripe.com"]:
            self.assertNotIn(forbidden, self.html)
        self.assertEqual(self.parser.scripts, [None])
    def test_accessible_forms(self):
        for required in ["checkDialog", "dialogTitle", "checkForm", "checks", "result", "ownerButton", "closeDialog"]:
            self.assertIn(required, self.parser.ids)
        self.assertIn('input.required=true', self.html)
        self.assertIn('textContent=statement', self.html)
    def test_legal_links_exist(self):
        self.assertTrue((ROOT / "legal.html").exists())
        self.assertTrue(any("legal.html" in href for href in self.parser.links))
    def test_no_deceptive_booking(self):
        self.assertIn("not a reservation", self.html)
        self.assertIn("no accounts, bookings, messages or payments".lower(), self.html.lower())

if __name__ == "__main__":
    unittest.main()
