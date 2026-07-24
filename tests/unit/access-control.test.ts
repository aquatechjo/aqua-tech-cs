import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCESS_ROLES,
  canEditTask,
  hasRole,
} from "../../src/lib/access-control";

test("only management roles can manage the company settings", () => {
  assert.equal(hasRole("OWNER", ACCESS_ROLES.companySettings), true);
  assert.equal(hasRole("ADMIN", ACCESS_ROLES.companySettings), true);
  assert.equal(hasRole("MEMBER", ACCESS_ROLES.companySettings), false);
});

test("task managers can edit any company task", () => {
  assert.equal(
    canEditTask(
      { id: "manager", role: "OPERATIONS_MANAGER" },
      { assignedToId: "employee", createdById: "creator" },
    ),
    true,
  );
});

test("access profiles grant business permissions without defining job titles", () => {
  assert.equal(
    hasRole("SALES_MANAGER", ACCESS_ROLES.clientManagement),
    true,
  );
  assert.equal(
    hasRole("SALES_MANAGER", ACCESS_ROLES.projectManagement),
    false,
  );
  assert.equal(
    hasRole("FINANCE_MANAGER", ACCESS_ROLES.teamManagement),
    false,
  );
});

test("employees can edit only tasks assigned to or created by them", () => {
  assert.equal(
    canEditTask(
      { id: "employee", role: "MEMBER" },
      { assignedToId: "employee", createdById: "creator" },
    ),
    true,
  );

  assert.equal(
    canEditTask(
      { id: "employee", role: "MEMBER" },
      { assignedToId: "other", createdById: "employee" },
    ),
    true,
  );

  assert.equal(
    canEditTask(
      { id: "employee", role: "MEMBER" },
      { assignedToId: "other", createdById: "creator" },
    ),
    false,
  );
});
