import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { baseDatabase } from "../lib/domain/seed";
import { applyPatch } from "../lib/domain/patch";
import {
  canAccessProject,
  canPayInvoice,
  canReviewDeliverable,
  canSeeTask,
  outstandingCents,
  pendingDeliverables,
  visibleInvoices,
  visibleProjects,
  visibleTasks,
} from "../lib/domain/permissions";
import { progressFor } from "../lib/domain/progress";
import { localStatusSummary } from "../lib/domain/summary";
import type { Actor } from "../lib/domain/types";

function actor(email: string): Actor {
  const db = baseDatabase();
  const user = db.users.find((item) => item.email === email);
  assert.ok(user, email);
  return user;
}

describe("tenant isolation", () => {
  const db = baseDatabase();

  it("keeps a client inside their own client and agency", () => {
    const priya = actor("priya@acmerobotics.com");
    const visible = visibleProjects(priya, db.projects).map((project) => project.id);
    assert.deepEqual(visible, ["prj_acme_brand"]);
    assert.equal(canAccessProject(priya, db.projects.find((project) => project.id === "prj_harbor_web")!), false);
    assert.equal(canAccessProject(priya, db.projects.find((project) => project.id === "prj_lumen_portal")!), false);
  });

  it("keeps Harbor's client off Acme and Fieldnote", () => {
    const luis = actor("luis@harborandco.com");
    assert.deepEqual(
      visibleProjects(luis, db.projects).map((project) => project.id),
      ["prj_harbor_web"],
    );
  });

  it("shows Lumen both of its projects and nothing from Northline", () => {
    const elena = actor("elena@lumenhealth.com");
    assert.deepEqual(
      visibleProjects(elena, db.projects).map((project) => project.id).sort(),
      ["prj_lumen_portal", "prj_lumen_q1"],
    );
  });

  it("lets a team member see the whole studio and not the other one", () => {
    const jordan = actor("jordan@northline.studio");
    assert.deepEqual(
      visibleProjects(jordan, db.projects).map((project) => project.id).sort(),
      ["prj_acme_brand", "prj_harbor_web"],
    );
  });

  it("lets the platform owner see every project", () => {
    const mustafa = actor("mustafa@quvantic.com");
    assert.equal(visibleProjects(mustafa, db.projects).length, 4);
  });

  it("hides internal tasks from clients", () => {
    const priya = actor("priya@acmerobotics.com");
    const project = db.projects.find((item) => item.id === "prj_acme_brand")!;
    const tasks = db.tasks.filter((task) => task.projectId === project.id);
    const visible = visibleTasks(priya, tasks, [project]);
    assert.ok(visible.every((task) => task.clientVisible));
    assert.equal(visible.some((task) => task.id === "t_acme_2"), false);
    assert.equal(canSeeTask(priya, tasks.find((task) => task.id === "t_acme_2")!, project), false);
    const maya = actor("maya@northline.studio");
    assert.equal(visibleTasks(maya, tasks, [project]).length, tasks.length);
  });

  it("scopes invoices and payment to the owning client", () => {
    const priya = actor("priya@acmerobotics.com");
    const luis = actor("luis@harborandco.com");
    const acme = db.invoices.find((invoice) => invoice.id === "inv_acme_identity")!;
    const harbor = db.invoices.find((invoice) => invoice.id === "inv_harbor_sprint")!;
    assert.deepEqual(
      visibleInvoices(priya, db.invoices).map((invoice) => invoice.id),
      ["inv_acme_identity"],
    );
    assert.equal(canPayInvoice(priya, acme), true);
    assert.equal(canPayInvoice(priya, harbor), false);
    assert.equal(canPayInvoice(luis, acme), false);
    assert.equal(canPayInvoice(actor("maya@northline.studio"), acme), false);
    assert.equal(outstandingCents(priya, db.invoices), 480000);
    assert.equal(outstandingCents(actor("maya@northline.studio"), db.invoices), 1320000);
  });

  it("only lets the owning client decide a deliverable", () => {
    const project = db.projects.find((item) => item.id === "prj_acme_brand")!;
    assert.equal(canReviewDeliverable(actor("priya@acmerobotics.com"), project), true);
    assert.equal(canReviewDeliverable(actor("luis@harborandco.com"), project), false);
    assert.equal(canReviewDeliverable(actor("maya@northline.studio"), project), false);
    assert.equal(canReviewDeliverable(actor("elena@lumenhealth.com"), project), false);
  });

  it("counts only pending deliverables the actor can see", () => {
    const maya = actor("maya@northline.studio");
    const ids = pendingDeliverables(maya, db.deliverables, db.projects).map((item) => item.id).sort();
    assert.deepEqual(ids, ["del_color", "del_homepage"]);
    const priya = actor("priya@acmerobotics.com");
    assert.deepEqual(
      pendingDeliverables(priya, db.deliverables, db.projects).map((item) => item.id),
      ["del_color"],
    );
  });

  it("calculates a lower progress number for the client view", () => {
    const tasks = db.tasks.filter((task) => task.projectId === "prj_acme_brand");
    const clientProgress = progressFor(tasks, actor("priya@acmerobotics.com"));
    const studioProgress = progressFor(tasks, actor("maya@northline.studio"));
    assert.ok(clientProgress < studioProgress);
    assert.equal(clientProgress, 56);
  });
});

describe("mock patch", () => {
  it("approves a deliverable without leaking it to another client", () => {
    const patched = applyPatch(baseDatabase(), {
      deliverableStatus: { del_color: "approved" },
      invoiceStatus: { inv_acme_identity: "paid" },
      commentCreate: [
        {
          id: "cmt_new",
          deliverableId: "del_color",
          authorId: "usr_priya",
          body: "Approved. Ship it.",
          createdAt: "2026-11-25T12:00:00.000Z",
        },
      ],
    });
    assert.equal(patched.deliverables.find((item) => item.id === "del_color")?.status, "approved");
    assert.equal(patched.invoices.find((item) => item.id === "inv_acme_identity")?.status, "paid");
    assert.equal(patched.comments.some((comment) => comment.id === "cmt_new"), true);
    const priya = actor("priya@acmerobotics.com");
    assert.equal(canAccessProject(priya, patched.projects.find((project) => project.id === "prj_lumen_q1")!), false);
  });
});

describe("local summary", () => {
  it("mentions the project, the open invoice, and the pending deliverable", () => {
    const db = baseDatabase();
    const project = db.projects.find((item) => item.id === "prj_acme_brand")!;
    const text = localStatusSummary({
      project,
      clientName: "Acme Robotics",
      tasks: db.tasks.filter((task) => task.projectId === project.id),
      deliverables: db.deliverables.filter((item) => item.projectId === project.id),
      invoices: db.invoices.filter((item) => item.projectId === project.id),
      actor: actor("maya@northline.studio"),
    });
    assert.match(text, /Atlas brand system/);
    assert.match(text, /Color and type/);
    assert.match(text, /\$4,800\.00/);
    assert.doesNotMatch(text, /lorem/i);
  });
});
