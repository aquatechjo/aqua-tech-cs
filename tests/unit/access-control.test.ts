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
  assert.equal(hasRole("DEVELOPER", ACCESS_ROLES.companySettings), false);
});

test("task managers can edit any company task", () => {
  assert.equal(
    canEditTask(
      { id: "manager", role: "PROJECT_MANAGER" },
      { assignedToId: "employee", createdById: "creator" },
    ),
    true,
  );
});

test("employees can edit only tasks assigned to or created by them", () => {
  assert.equal(
    canEditTask(
      { id: "employee", role: "DEVELOPER" },
      { assignedToId: "employee", createdById: "creator" },
    ),
    true,
  );

  assert.equal(
    canEditTask(
      { id: "employee", role: "DEVELOPER" },
      { assignedToId: "other", createdById: "employee" },
    ),
    true,
  );

  assert.equal(
    canEditTask(
      { id: "employee", role: "DEVELOPER" },
      { assignedToId: "other", createdById: "creator" },
    ),
    false,
  );
});
