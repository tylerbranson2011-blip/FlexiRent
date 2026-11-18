#!/usr/bin/env python3
"""Static guardrails for proposed contact-only backend. Not a substitute for staging RLS tests."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]/"proposals"
class ProposalSafety(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.inquiries=(ROOT/"connection-inquiries-staging.sql").read_text()
        cls.reports=(ROOT/"connection-reports-staging.sql").read_text()
    def test_both_tables_enable_rls(self):
        self.assertIn("alter table public.connection_inquiries enable row level security",self.inquiries)
        self.assertIn("alter table public.connection_reports enable row level security",self.reports)
    def test_no_anonymous_rpc_execution(self):
        for sql,fn in [(self.inquiries,"send_connection_inquiry(uuid,text,text)"),(self.reports,"submit_connection_report(uuid,uuid,text,text)")]:
            self.assertIn(f"revoke all on function public.{fn} from public,anon",sql)
            self.assertIn(f"grant execute on function public.{fn} to authenticated",sql)
            self.assertIn("Verified account required",sql)
    def test_no_client_insert_permissions(self):
        for sql,table in [(self.inquiries,"connection_inquiries"),(self.reports,"connection_reports")]:
            self.assertIn(f"revoke all on public.{table} from anon,authenticated",sql)
            self.assertNotIn(f"grant insert on public.{table} to authenticated",sql)
    def test_rate_limit_serialized(self):
        self.assertIn("pg_advisory_xact_lock",self.inquiries)
        self.assertIn("pg_advisory_xact_lock",self.reports)
    def test_contact_is_not_booking(self):
        self.assertNotIn("create table public.bookings",self.inquiries.lower())
        self.assertNotIn("stripe",self.inquiries.lower())
    def test_inquiry_checks_both_consents(self):
        self.assertIn("c.role='renter'",self.inquiries)
        self.assertIn("c.role='owner'",self.inquiries)
        self.assertIn("l.status='published'",self.inquiries)
    def test_reports_are_participant_only(self):
        self.assertIn("i.renter_id=v_user or i.owner_id=v_user",self.reports)
        self.assertIn("reporter_id=(select auth.uid())",self.reports)
if __name__=="__main__":
    unittest.main()
