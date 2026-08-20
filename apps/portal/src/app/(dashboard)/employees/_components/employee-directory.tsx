"use client";

import { useState, useTransition } from "react";
import { countEmployeesByRole, filterEmployees } from "../_lib/employee-filters";
import { EmployeeDirectoryFilters } from "./employee-directory-filters";
import { EmployeeDirectoryHeader } from "./employee-directory-header";
import { EmployeeTable } from "./employee-table";
import type { EmployeeRecord } from "../types";

export function EmployeeDirectory({ employees }: { employees: EmployeeRecord[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [isFiltering, startTransition] = useTransition();

  const handleSearchChange = (term: string) => {
    startTransition(() => {
      setSearchTerm(term);
    });
  };

  const handleRoleChange = (role: string) => {
    startTransition(() => {
      setRoleFilter(role);
    });
  };

  const filteredEmployees = filterEmployees(employees, searchTerm, roleFilter);
  const roleCounts = countEmployeesByRole(employees);

  return (
    <div className="form-panel" style={{ gap: "20px" }}>
      <EmployeeDirectoryHeader employeeCount={employees.length} roleCounts={roleCounts} />
      <EmployeeDirectoryFilters
        roleFilter={roleFilter}
        searchTerm={searchTerm}
        isFiltering={isFiltering}
        setRoleFilter={handleRoleChange}
        setSearchTerm={handleSearchChange}
      />
      <EmployeeTable employees={filteredEmployees} />
    </div>
  );
}
