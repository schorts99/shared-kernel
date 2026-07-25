---
name: add-jsonapi-connector
description: Instructions for mapping domain models to JSON:API endpoints using criteria parsers and HTTP providers.
---

# 🛠️ Skill: Integrate JSON:API Endpoints

This skill explains how to consume and query external JSON:API compliant services.

---

## Step 1: Initialize Provider & Connector

Combine `FetchHTTPProvider` with `JSONAPIConnector`:

```typescript
import { FetchHTTPProvider } from "@schorts/shared-kernel/http";
import { JSONAPIConnector } from "@schorts/shared-kernel/json-api";

const httpProvider = new FetchHTTPProvider();
const connector = new JSONAPIConnector(httpProvider);
```

---

## Step 2: Build Fluent Criteria

Construct query filters, sorting, and pagination using `Criteria`:

```typescript
import { Criteria } from "@schorts/shared-kernel/criteria";

const criteria = new Criteria()
  .where("status", "EQUAL", "active")
  .where("category", "EQUAL", "electronics")
  .orderBy("created_at", "DESC")
  .offsetResults(0)
  .limitResults(25);
```

---

## Step 3: Execute Requests

Execute typed GET requests against the JSON:API endpoint:

```typescript
const endpointUrl = new URL("https://api.example.com/products");
const products = await connector.findMany<ProductModel>(endpointUrl, criteria);
```

---

## Step 4: Parse URL Query Strings (Server-side)

Parse incoming JSON:API URL request parameters into `Criteria`:

```typescript
import { URLCriteriaParser } from "@schorts/shared-kernel/json-api";

const reqUrl = new URL("https://api.example.com/products?filter[status]=active&sort=-created_at&page[limit]=10");
const criteria = URLCriteriaParser.parse(reqUrl);
```
