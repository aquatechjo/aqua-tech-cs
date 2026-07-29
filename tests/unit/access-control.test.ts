import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCESS_ROLES,
  canApproveTimesheet,
  canApproveLeave,
  canViewCompanyHr,
  canAssignTaskOwner,
  canEditTask,
  canManageProjectExecution,
  canManageProjectLeadership,
  canManageTaskParticipants,
  canViewCompanyTime,
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
  assert.equal(hasRole("FINANCE_MANAGER", ACCESS_ROLES.clientRead), true);
  assert.equal(hasRole("FINANCE_MANAGER", ACCESS_ROLES.clientManagement), false);
  assert.equal(hasRole("MEMBER", ACCESS_ROLES.clientRead), false);
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

test("execution participants can edit work while observers remain read-only", () => {
  const baseTask = {
    assignedToId: "owner",
    createdById: "creator",
  };

  assert.equal(
    canEditTask(
      { id: "reviewer", role: "MEMBER" },
      {
        ...baseTask,
        participants: [{ userId: "reviewer", role: "REVIEWER" }],
      },
    ),
    true,
  );

  assert.equal(
    canEditTask(
      { id: "observer", role: "MEMBER" },
      {
        ...baseTask,
        participants: [{ userId: "observer", role: "OBSERVER" }],
      },
    ),
    false,
  );
});

test("project leads and managers can manage project execution", () => {
  assert.equal(canManageProjectExecution({ role: "MEMBER" }, "PROJECT_LEAD"), true);
  assert.equal(canManageProjectExecution({ role: "MEMBER" }, "MANAGER"), true);
  assert.equal(canManageProjectExecution({ role: "MEMBER" }, "VIEWER"), false);
  assert.equal(
    canManageProjectExecution({ role: "OPERATIONS_MANAGER" }, null),
    true,
  );
});

test("project managers can update tasks inside their project", () => {
  assert.equal(
    canEditTask(
      { id: "project-manager", role: "MEMBER" },
      {
        assignedToId: "owner",
        createdById: "creator",
        projectMemberRole: "MANAGER",
      },
    ),
    true,
  );
});

test("team managers can manage work assigned to their own members only", () => {
  assert.equal(
    canEditTask(
      { id: "team-manager", role: "MEMBER" },
      {
        assignedToId: "team-member",
        createdById: "creator",
        managedUserIds: ["team-member"],
      },
    ),
    true,
  );

  assert.equal(
    canManageTaskParticipants(
      { id: "team-manager", role: "MEMBER" },
      {
        assignedToId: "other",
        createdById: "creator",
        managedUserIds: ["team-member"],
        participants: [
          { userId: "team-member", role: "CONTRIBUTOR" },
        ],
      },
    ),
    true,
  );

  assert.equal(
    canEditTask(
      { id: "team-manager", role: "MEMBER" },
      {
        assignedToId: "outside-member",
        createdById: "creator",
        managedUserIds: ["team-member"],
      },
    ),
    false,
  );
});

test("only leadership can assign project leads and task owners", () => {
  assert.equal(canManageProjectLeadership({ role: "MEMBER" }, "PROJECT_LEAD"), true);
  assert.equal(canManageProjectLeadership({ role: "MEMBER" }, "MANAGER"), false);
  assert.equal(canManageProjectLeadership({ role: "ADMIN" }, null), true);

  assert.equal(canAssignTaskOwner({ role: "MEMBER" }, "MANAGER"), true);
  assert.equal(canAssignTaskOwner({ role: "MEMBER" }, "CONTRIBUTOR"), false);
});

test("task owners can manage participants but contributors cannot", () => {
  const task = {
    assignedToId: "owner",
    createdById: "creator",
    participants: [
      { userId: "owner", role: "OWNER" as const },
      { userId: "contributor", role: "CONTRIBUTOR" as const },
    ],
  };

  assert.equal(
    canManageTaskParticipants({ id: "owner", role: "MEMBER" }, task),
    true,
  );
  assert.equal(
    canManageTaskParticipants({ id: "contributor", role: "MEMBER" }, task),
    false,
  );
});


test("finance access separates visibility from financial mutations", () => {
  assert.equal(hasRole("FINANCE_MANAGER", ACCESS_ROLES.financeRead), true);
  assert.equal(hasRole("FINANCE_MANAGER", ACCESS_ROLES.financeManagement), true);
  assert.equal(hasRole("OPERATIONS_MANAGER", ACCESS_ROLES.financeRead), true);
  assert.equal(hasRole("OPERATIONS_MANAGER", ACCESS_ROLES.financeManagement), false);
  assert.equal(hasRole("SALES_MANAGER", ACCESS_ROLES.financeRead), false);
});

test("sales access separates pipeline visibility from sales mutations", () => {
  assert.equal(hasRole("SALES_MANAGER", ACCESS_ROLES.salesRead), true);
  assert.equal(hasRole("SALES_MANAGER", ACCESS_ROLES.salesManagement), true);
  assert.equal(hasRole("OPERATIONS_MANAGER", ACCESS_ROLES.salesRead), true);
  assert.equal(hasRole("OPERATIONS_MANAGER", ACCESS_ROLES.salesManagement), false);
  assert.equal(hasRole("FINANCE_MANAGER", ACCESS_ROLES.salesRead), false);
});


test("time access separates personal logging company visibility and approval", () => {
  assert.equal(canViewCompanyTime("MEMBER"), false)
  assert.equal(canViewCompanyTime("FINANCE_MANAGER"), true)
  assert.equal(canViewCompanyTime("OPERATIONS_MANAGER"), true)

  assert.equal(
    canApproveTimesheet({ id: "owner", role: "OWNER" }, "owner"),
    true,
    "the owner may self-approve when no higher approver exists",
  )
  assert.equal(
    canApproveTimesheet({ id: "admin", role: "ADMIN" }, "admin"),
    false,
  )
  assert.equal(
    canApproveTimesheet({ id: "admin", role: "ADMIN" }, "member"),
    true,
  )
  assert.equal(
    canApproveTimesheet(
      { id: "finance", role: "FINANCE_MANAGER" },
      "member",
    ),
    false,
  )
})


test("HR access separates self service from company administration", () => {
  assert.equal(canViewCompanyHr("MEMBER"), false)
  assert.equal(canViewCompanyHr("OPERATIONS_MANAGER"), true)
  assert.equal(
    canApproveLeave({ id: "manager", role: "OPERATIONS_MANAGER" }, "employee"),
    true,
  )
  assert.equal(
    canApproveLeave({ id: "employee", role: "OPERATIONS_MANAGER" }, "employee"),
    false,
  )
  assert.equal(canApproveLeave({ id: "owner", role: "OWNER" }, "owner"), true)
})
