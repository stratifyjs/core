import { expectError, expectType } from "tsd";
import * as api from ".";
import {
  adapter,
  controller,
  createAdapter,
  createController,
  createHooks,
  createInstaller,
  createModule,
  createProvider,
  hooks,
  installer,
  mod,
  provider,
} from ".";

expectType<typeof createProvider>(provider);
expectType<typeof createModule>(mod);
expectType<typeof createHooks>(hooks);
expectType<typeof createController>(controller);
expectType<typeof createInstaller>(installer);
expectType<typeof createAdapter>(adapter);

expectError(api.getProviderId);
expectError(api.resolveDeps);
expectError(api.getModuleId);
expectError(api.registerModule);
expectError(api.resolveProviderMap);
expectError(api.resolveAdapterMap);
expectError(api.HttpHooksBuilder);
expectError(api.AppHooksBuilder);
expectError(api.RoutesBuilder);
