import { ApplicantsList } from "@/components/employer/applicants-list";

export default function EmployerApplicantsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Applicants</h1>
      <ApplicantsList />
    </div>
  );
}
