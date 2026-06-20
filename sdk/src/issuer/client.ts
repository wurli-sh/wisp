/** @deprecated Import from ./http-adapter.js or @wisp_/sdk */
export {
  HttpIssuerAdapter,
  HttpIssuerAdapter as IssuerClient,
  type CorridorDetail,
  type IssuerWellKnown,
} from "./http-adapter.js";
export type {
  MockKycChallengeResponse,
  MockKycLifecycleStatus,
  MockKycMissing,
  MockKycRootsStatus,
  MockKycStatusResponse,
  MockKycSubmitRequest,
  MockKycSubmitResponse,
  MockKycSubmitStatus,
} from "./demo-client.js";
export { DemoIssuerClient } from "./demo-client.js";
