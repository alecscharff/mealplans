import assert from "node:assert/strict";
import { test } from "node:test";
import { emailMode, interpretMenuReply } from "./menuEmail.js";

const chicken = { uid: "chicken", name: "Lemon Chicken" };
const salmon = { uid: "salmon", name: "Roasted Salmon" };

test("missing and invalid email settings default to off", () => {
  assert.equal(emailMode(), "off");
  assert.equal(emailMode({ emailMode: "all" }), "off");
  assert.equal(emailMode({ emailMode: "replies" }), "replies");
});

test("only an unambiguous named swap produces a menu change", () => {
  assert.deepEqual(interpretMenuReply("Swap Lemon Chicken for Roasted Salmon.", [chicken], [salmon]), {
    type: "swap", outgoing: chicken, incoming: salmon,
  });
  assert.equal(interpretMenuReply("Swap chicken for salmon", [chicken], [salmon]).type, "clarify");
  assert.equal(interpretMenuReply("Swap Lemon Chicken for Roasted Salmon", [chicken], [salmon, { ...salmon, uid: "other" }]).type, "clarify");
  assert.equal(interpretMenuReply("Swap Lemon Chicken for Roasted Salmon\nSee quoted message", [chicken], [salmon]).type, "clarify");
});

test("quicker requests and recipe links never produce a menu change", () => {
  assert.equal(interpretMenuReply("Can we do something quicker?", [chicken], [salmon]).type, "quicker");
  assert.deepEqual(interpretMenuReply("Try https://example.com/recipe.", [chicken], [salmon]), {
    type: "suggestion", url: "https://example.com/recipe",
  });
});

test("explicit library commands are distinct from suggestions and menu changes", () => {
  assert.deepEqual(interpretMenuReply("Add this recipe https://example.com/soup", [], []), {
    type: "import", url: "https://example.com/soup",
  });
  assert.deepEqual(interpretMenuReply("Delete the Lemon Chicken recipe", [], []), {
    type: "requestDelete", name: "lemon chicken",
  });
  assert.deepEqual(interpretMenuReply("CONFIRM DELETE a0b1c2d3e4f5", [], []), {
    type: "confirmDelete", code: "a0b1c2d3e4f5",
  });
  assert.equal(interpretMenuReply("Delete Lemon Chicken from this week's menu", [], []).type, "clarify");
});
