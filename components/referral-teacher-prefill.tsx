"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function ReferralTeacherPrefill() {
  useEffect(() => {
    if (window.location.pathname !== "/admin/matriculas") return;

    const leadId = new URLSearchParams(window.location.search).get("lead");
    if (!leadId || !/^[0-9a-f-]{36}$/i.test(leadId)) return;

    let cancelled = false;

    async function applyReferralTeacher() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("enrollment_requests")
        .select("assigned_to_teacher_id")
        .eq("id", leadId)
        .maybeSingle();

      if (cancelled || error || !data?.assigned_to_teacher_id) return;

      const teacherSelect = document.querySelector<HTMLSelectElement>(
        '#nova-matricula select[name="teacherId"]'
      );
      if (!teacherSelect) return;

      const optionExists = Array.from(teacherSelect.options).some(
        (option) => option.value === data.assigned_to_teacher_id
      );
      if (!optionExists) return;

      teacherSelect.value = data.assigned_to_teacher_id;
      teacherSelect.dataset.referralPrefilled = "true";
      teacherSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }

    void applyReferralTeacher();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
