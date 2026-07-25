---
name: add-saga-workflow
description: Procedure for building multi-step Saga business workflows with compensations and state persistence.
---

# 🛠️ Skill: Create a Saga Workflow

This skill explains how to build a multi-step, stateful Saga workflow that handles step handlers, compensations, and state persistence.

---

## Step 1: Define Saga State & Class

Create a new Saga class extending `Saga<State>` in `src/sagas/`:

```typescript
import { Saga } from "./saga";

export interface OrderFulfillmentState {
  orderId: string;
  paymentId?: string;
  shipmentId?: string;
  status: "PENDING" | "PAID" | "SHIPPED" | "FAILED";
}

export class OrderFulfillmentSaga extends Saga<OrderFulfillmentState> {
  constructor(sagaId: string, initialState: OrderFulfillmentState) {
    super(sagaId, initialState);
  }
}
```

---

## Step 2: Configure Steps and Compensations

Define step logic and rollback compensations:

```typescript
const saga = new OrderFulfillmentSaga("saga-101", {
  orderId: "order-555",
  status: "PENDING",
});

// Step 1: Process Payment
saga.addStep({
  name: "ProcessPayment",
  execute: async (state) => {
    // Process payment logic
    state.paymentId = "pay-789";
    state.status = "PAID";
  },
  compensate: async (state) => {
    if (state.paymentId) {
      // Refund payment logic
    }
  },
});

// Step 2: Create Shipment
saga.addStep({
  name: "CreateShipment",
  execute: async (state) => {
    // Trigger shipping logic
    state.shipmentId = "ship-123";
    state.status = "SHIPPED";
  },
  compensate: async (state) => {
    if (state.shipmentId) {
      // Cancel shipment logic
    }
  },
});
```

---

## Step 3: Orchestrate with SagaManager & StateStore

Run and persist state across restarts:

```typescript
import { SagaManager } from "./saga-manager";
import { InMemorySagaStateStore } from "./in-memory/in-memory-saga-state-store";

const stateStore = new InMemorySagaStateStore();
const sagaManager = new SagaManager(stateStore);

await sagaManager.execute(saga);
```
