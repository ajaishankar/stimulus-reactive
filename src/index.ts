import { Application, Controller } from "@hotwired/stimulus";
import {
  EffectScope,
  ShallowRef,
  effectScope,
  shallowReactive,
  shallowRef,
  computed as vueComputed,
  effect as vueEffect,
} from "@vue/reactivity";

export type Effect = (fn: () => unknown) => void;
export type Computed = <T>(fn: () => T) => { value: T };

type ReactiveController = Controller & {
  __reactive: {
    state: Record<string, unknown>;
    scope: EffectScope;
  };
};
type OutletsRef<T = Controller> = ShallowRef<T[]>;

function getPropertyDescriptors(
  prototype: object,
  pattern: RegExp,
  checkAncestors = true
) {
  const matches = {} as { [name: string]: PropertyDescriptor };
  while (prototype != null) {
    const descriptors = Object.getOwnPropertyDescriptors(prototype);
    for (const name in descriptors) {
      if (pattern.test(name) && !(name in matches)) {
        matches[name] = descriptors[name];
      }
    }
    if (checkAncestors) {
      prototype = Object.getPrototypeOf(prototype);
    } else {
      break;
    }
  }
  return matches;
}

export function useStimulusReactive(
  identifier: string,
  application: Application
) {
  const definition = application.router.modules.find(
    (module) => module.identifier === identifier
  );
  const prototype = definition!.controllerConstructor.prototype;
  const values = getPropertyDescriptors(prototype, /^(?!has).+Value$/, false);
  const outlets = getPropertyDescriptors(prototype, /^(?!has).+Outlet$/, false);
  const methods = getPropertyDescriptors(
    prototype,
    /^initialize|disconnect|(.+)(ValueChanged|OutletConnected|OutletDisconnected)$/
  );

  function initialize(this: ReactiveController) {
    if (this.__reactive == null) {
      _initialize.call(this);
    }
    methods["initialize"].value.call(this);
  }

  function _initialize(this: ReactiveController) {
    this.__reactive = {
      state: shallowReactive({}),
      scope: effectScope(),
    };

    Object.entries(values).forEach(([key, { set: originalSet }]) => {
      this.__reactive.state[key] = undefined;
      Object.defineProperty(this, key, {
        get() {
          return this.__reactive.state[key];
        },
        set(value: any) {
          this.__reactive.state[key] = value;
          originalSet!.call(this, value);
        },
      });
    });

    Object.entries(outlets).forEach(([key, { get: originalGet }]) => {
      const outletsKey = `${key}s`;
      const hasOutletKey = "has" + key[0].toUpperCase() + key.substring(1);
      this.__reactive.state[outletsKey] = shallowRef([]);
      Object.defineProperty(this, outletsKey, {
        get() {
          return this.__reactive.state[outletsKey].value;
        },
      });
      Object.defineProperty(this, hasOutletKey, {
        get() {
          return this.__reactive.state[outletsKey].value.length > 0;
        },
      });
      Object.defineProperty(this, key, {
        get() {
          const ref = this.__reactive.state[outletsKey] as OutletsRef;
          return ref.value[0] ?? originalGet!.call(this);
        },
      });
    });
  }

  function disconnect(this: ReactiveController) {
    this.__reactive.scope.stop();
    this.__reactive.scope = effectScope();
    methods["disconnect"].value.call(this);
  }

  function valueChanged(name: string) {
    const valueChangedKey = `${name}Changed`;
    Object.defineProperty(prototype, valueChangedKey, {
      value: function (
        this: ReactiveController,
        value: unknown,
        previousValue: unknown
      ) {
        this.__reactive.state[name] = value;
        methods[valueChangedKey]?.value?.call(this, value, previousValue);
      },
    });
  }

  function outletConnected(name: string) {
    const outletsKey = `${name}s`;
    const connectedKey = `${name}Connected`;

    Object.defineProperty(prototype, connectedKey, {
      value: function (
        this: ReactiveController,
        controller: Controller,
        element: Element
      ) {
        const ref = this.__reactive.state[outletsKey] as OutletsRef;
        ref.value = [...ref.value, controller];
        methods[connectedKey]?.value?.call(this, controller, element);
      },
    });
  }

  function outletDisconnected(name: string) {
    const outletsKey = `${name}s`;
    const disconnectedKey = `${name}Disconnected`;

    Object.defineProperty(prototype, disconnectedKey, {
      value: function (
        this: ReactiveController,
        controller: Controller,
        element: Element
      ) {
        const ref = this.__reactive.state[outletsKey] as OutletsRef;
        ref.value = ref.value.filter((outlet) => outlet !== controller);
        methods[disconnectedKey]?.value?.call(this, controller, element);
      },
    });
  }

  function effect(this: ReactiveController, fn: () => unknown) {
    this.__reactive.scope.run(() => vueEffect(fn));
  }

  function computed<T>(this: ReactiveController, fn: () => T): { value: T } {
    const computedRef = this.__reactive.scope.run(() => vueComputed(fn));
    return computedRef!;
  }

  Object.defineProperty(prototype, "effect", { value: effect });
  Object.defineProperty(prototype, "computed", { value: computed });
  Object.defineProperty(prototype, "initialize", { value: initialize });
  Object.defineProperty(prototype, "disconnect", { value: disconnect });
  Object.keys(values).forEach((key) => valueChanged(key));
  Object.keys(outlets).forEach((key) => outletConnected(key));
  Object.keys(outlets).forEach((key) => outletDisconnected(key));
}
