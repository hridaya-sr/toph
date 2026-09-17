"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteEmployee } from "@/app/actions/employees";
import { Avatar } from "@/components/avatar";

export type EmployeeRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarColor: string | null;
  avatarImage: string | null;
  logCount: number;
};

export function EmployeesTable({ employees }: { employees: EmployeeRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100 text-left text-xs text-zinc-400">
            <th className="px-5 py-3 font-medium">Name</th>
            <th className="px-2 py-3 font-medium">Role</th>
            <th className="px-2 py-3 font-medium">Email</th>
            <th className="px-2 py-3 font-medium">Logged Activities</th>
            <th className="px-5 py-3 font-medium" />
          </tr>
        </thead>
        <tbody>
          {employees.map((e) => (
            <EmployeeRowItem key={e.id} employee={e} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmployeeRowItem({ employee }: { employee: EmployeeRow }) {
  const [isDeleting, startTransition] = useTransition();

  const handleDelete = () => {
    const confirmed = window.confirm(
      `Delete ${employee.name}? This permanently removes their account, and every activity log and shift attached to it. They will no longer be able to log in. This can't be undone.`
    );
    if (!confirmed) return;
    startTransition(async () => {
      await deleteEmployee(employee.id);
    });
  };

  return (
    <tr className="border-b border-zinc-50">
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <Avatar name={employee.name} avatarColor={employee.avatarColor} avatarImage={employee.avatarImage} size={28} />
          {employee.name}
        </div>
      </td>
      <td className="px-2 py-3 capitalize text-zinc-600">{employee.role}</td>
      <td className="px-2 py-3 text-zinc-500">{employee.email}</td>
      <td className="px-2 py-3 text-zinc-500">{employee.logCount}</td>
      <td className="px-5 py-3 text-right">
        {employee.role === "employee" && (
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            title="Delete employee"
            aria-label={`Delete ${employee.name}`}
            className="text-red-500 hover:text-red-700 disabled:opacity-50"
          >
            <Trash2 size={15} />
          </button>
        )}
      </td>
    </tr>
  );
}
