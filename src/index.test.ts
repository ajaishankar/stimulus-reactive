import { Application, Controller } from "@hotwired/stimulus";
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { createEvent, fireEvent, screen, waitFor } from "@testing-library/dom";
import { EffectScope, ShallowRef, computed, toRaw } from "@vue/reactivity";
import { Computed, Effect, useStimulusReactive } from ".";

type HtmlInputEvent = {
  target: { value: string };
};

type ReactiveController = Controller & {
  __reactive: {
    state: Record<string, unknown>;
    scope: EffectScope;
  };
};
type OutletsRef<T = Controller> = ShallowRef<T[]>;

class CartItemController extends Controller {
  static targets = ["total"];
  static values = {
    price: Number,
    quantity: { type: Number, default: 1 },
  };

  declare totalTarget: HTMLElement;
  declare priceValue: number;
  declare quantityValue: number;
  declare totalValue: number;
  declare effect: Effect;

  static afterLoad(identifier: string, application: Application) {
    useStimulusReactive(identifier, application);
  }

  connect() {
    this.effect(() => {
      this.totalTarget.textContent = (
        this.priceValue * this.quantityValue
      ).toString();
    });
  }

  setQuantity(event: HtmlInputEvent) {
    const value = parseInt(event.target.value);
    this.quantityValue = isNaN(value) ? 0 : value;
  }
}

class CartController extends Controller {
  static targets = ["checkout", "cartTotal"];
  static outlets = ["cart-item"];

  declare checkoutTarget: HTMLButtonElement;
  declare cartTotalTarget: HTMLElement;
  declare cartItemOutlets: CartItemController[];
  declare hasCartItemOutlet: boolean;
  declare cartItemOutlet: CartItemController;
  declare effect: Effect;
  declare computed: Computed;

  static afterLoad(identifier: string, application: Application) {
    useStimulusReactive(identifier, application);
  }

  connect() {
    const total = this.computed(() =>
      this.cartItemOutlets.reduce(
        (total, item) => total + item.priceValue * item.quantityValue,
        0
      )
    );
    this.effect(() => (this.checkoutTarget.disabled = total.value <= 0));
    this.effect(
      () => (this.cartTotalTarget.textContent = total.value.toString())
    );
  }

  isDisconnected = false;
  disconnect() {
    this.isDisconnected = true;
  }
}

class DebugController extends Controller {
  static values = {
    property: Number,
  };
  static outlets = ["debug"];

  logs: string[] = [];

  declare propertyValue: number;
  declare debugOutlets: DebugController[];

  static afterLoad(identifier: string, application: Application) {
    useStimulusReactive(identifier, application);
  }

  private log(message: string) {
    this.logs.push(`${this.element.id} ${message}`);
  }

  initialize() {
    this.log("initialize");
  }

  connect() {
    this.log("connect");
  }

  isDisconnected = false;
  disconnect() {
    this.log("disconnect");
    this.isDisconnected = true;
  }

  propertyValueChanged(value: number, previousValue: number) {
    this.log(`value changed from ${previousValue} to ${value}`);
  }

  debugOutletConnected(outlet: DebugController, element: Element) {
    expect(outlet).toBeTruthy();
    expect(element).toBeTruthy();
    // switch outlet logs to test sequence of calls
    this.logs.push(...outlet.logs);
    outlet.logs = this.logs;
    this.log(`outlet connected`);
  }

  debugOutletDisconnected(outlet: Controller, element: Element) {
    expect(outlet).toBeTruthy();
    expect(element).toBeTruthy();
    this.log(`outlet disconnected`);
  }
}

const fireInputEvent = (selector: string, value: string) => {
  const element = document.querySelector(selector)!;
  document.querySelector(selector);
  fireEvent.input(
    element,
    createEvent("input", element, {
      target: { value },
    })
  );
};

function verifyContent(testId: string, value: any) {
  return waitFor(() => {
    expect(screen.getByTestId(testId).textContent).toBe(value.toString());
  });
}

function verifyAttribute(testId: string, name: string, value: any) {
  return waitFor(() => {
    const attr = screen.getByTestId(testId).getAttribute(name);
    if (value === true) {
      expect(attr).not.toBeNull();
    } else if (value === false) {
      expect(attr).toBeNull();
    } else {
      expect(attr).toEqual(value.toString());
    }
  });
}

function waitUntil(predicate: () => boolean) {
  return waitFor(() => expect(predicate()).toBe(true));
}

const itemHTML = (itemId: string, price: number) => `
  <div id="${itemId}"
    data-testId="${itemId}"
    data-controller="cart-item"
    data-cart-item-price-value="${price}"
    class="cart-item"
  >
    Quantity : <input class="quantity" type="text" data-action="cart-item#setQuantity" />
    Total    : <div data-testid="${itemId}-total" data-cart-item-target="total"></div>
  </div>
`;

const cartHTML = () => `
  <div id="cart" data-controller="cart" data-cart-cart-item-outlet=".cart-item">
    Total: <div data-testid="cart-total" data-cart-target="cartTotal"></div>
    <button data-testid="checkout" data-cart-target="checkout">Checkout</button>
  </div>
`;

describe("stimulus reactive", () => {
  let application: Application;

  function getController<T = ReactiveController>(
    elementId: string,
    identifier: string
  ) {
    const controller = application.getControllerForElementAndIdentifier(
      document.querySelector(`#${elementId}`)!,
      identifier
    );
    return controller as T;
  }

  function waitForController<T = ReactiveController>(
    elementId: string,
    identifier: string
  ) {
    return waitFor(() => {
      const controller = getController(elementId, identifier);
      expect(controller).not.toBe(null);
      return controller as T;
    });
  }

  beforeEach(() => {
    document.body.innerHTML = `${cartHTML()} ${itemHTML("item-1", 5)}`;
    application = Application.start();
    application.register("cart-item", CartItemController);
    application.register("cart", CartController);
    application.register("debug", DebugController);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("should initialize state from dom", async () => {
    await verifyContent("item-1-total", 5);
    await verifyContent("cart-total", 5);
    await verifyAttribute("checkout", "disabled", false);
  });

  it("should react to value changes", async () => {
    fireInputEvent("#item-1 .quantity", "2");
    await verifyContent("item-1-total", 10);
    await verifyContent("cart-total", 10);
  });

  it("should react to outlet connects", async () => {
    document.body.insertAdjacentHTML("beforeend", itemHTML("item-2", 10));
    await verifyContent("item-2-total", 10);
    await verifyContent("cart-total", 15);
  });

  it("should react to outlet disconnects", async () => {
    document.querySelector("#item-1")!.remove();
    await verifyContent("cart-total", 0);
    await verifyAttribute("checkout", "disabled", true);
  });

  describe("controller", () => {
    it("should have reactive state and scope", () => {
      const cart = getController("cart", "cart");
      const item = getController("item-1", "cart-item");

      expect(cart.__reactive.scope.active).toBe(true);
      expect(item.__reactive.scope.active).toBe(true);

      const cartState = toRaw(cart.__reactive.state) as {
        cartItemOutlets: OutletsRef;
      };
      const itemState = toRaw(item.__reactive.state);

      expect(cartState.cartItemOutlets.value.length).toBe(1);
      expect(itemState).toEqual({
        priceValue: 5,
        quantityValue: 1,
      });
    });

    it("should manage outlets efficiently (with ref instead of reactive array)", async () => {
      const cart = getController<CartController>("cart", "cart");

      for (let i = 2; i <= 10; ++i) {
        document.body.insertAdjacentHTML(
          "beforeend",
          itemHTML(`item-${i}`, 10)
        );
      }
      await waitUntil(() => cart.cartItemOutlets.length === 10);

      let computes = 0;
      const count = computed(() => {
        computes += 1;
        return cart.cartItemOutlets.length;
      });
      expect(count.value).toBe(10);
      expect(computes).toBe(1);

      document.querySelector("#item-1")!.remove();

      await waitUntil(() => cart.cartItemOutlets.length === 9);

      expect(count.value).toBe(9);
      expect(computes).toBe(2);
    });

    describe("disconnect", () => {
      it("should cleanup scope", async () => {
        const cart = getController("cart", "cart");

        const oldScope = cart.__reactive.scope;
        expect(oldScope.active).toBe(true);

        document.body.innerHTML = "";

        await waitUntil(
          () => (cart as unknown as CartController).isDisconnected
        );

        const newScope = cart.__reactive.scope;
        expect(newScope).not.toBe(oldScope);
        expect(newScope.active).toBe(true);
      });

      it("should let stimulus disconnect outlets", async () => {
        const cart = getController("cart", "cart");

        document.body.innerHTML = "";

        await waitUntil(
          () => (cart as unknown as CartController).isDisconnected
        );

        const cartState = toRaw(cart.__reactive.state) as {
          cartItemOutlets: OutletsRef;
        };

        expect(cartState.cartItemOutlets.value.length).toBe(0);
      });

      it("should leave values untouched (as disconnect can be called before parent outlet disconnect)", async () => {
        const cart = getController("cart", "cart");
        const item = getController("item-1", "cart-item");

        document.body.innerHTML = "";

        await waitUntil(
          () => (cart as unknown as CartController).isDisconnected
        );

        const itemState = toRaw(item.__reactive.state);

        expect(itemState).toEqual({
          priceValue: 5,
          quantityValue: 1,
        });
      });
    });

    it("should add value and outlet properties to instance", () => {
      const cart = getController("cart", "cart");
      const item = getController("item-1", "cart-item");

      const cartProperties = Object.getOwnPropertyNames(cart);
      expect(cartProperties).toContain("cartItemOutlets");
      expect(cartProperties).toContain("cartItemOutlet");
      expect(cartProperties).toContain("hasCartItemOutlet");

      const itemProperties = Object.getOwnPropertyNames(item);
      expect(itemProperties).toContain("priceValue");
      expect(itemProperties).toContain("quantityValue");
    });

    it("should set value and invoke stimulus setter", async () => {
      const item = getController<CartItemController>("item-1", "cart-item");
      item.priceValue = 10;
      expect(item.priceValue).toBe(10);
      await verifyAttribute("item-1", "data-cart-item-price-value", 10);
    });

    it("should not recreate state when stimulus reuses controller instance", () => {
      const cart = getController("cart", "cart");
      const reactive = cart.__reactive;
      expect(reactive).toBeTruthy();
      cart.initialize(); // simulate controller reuse
      expect(cart.__reactive).toBe(reactive);
    });

    it("should let stimulus handle absent outlet", async () => {
      const cart = getController<CartController>("cart", "cart");

      expect(cart.cartItemOutlet).toBeDefined();

      document.querySelector("#item-1")!.remove();
      await waitFor(() => expect(cart.cartItemOutlets.length).toBe(0));

      expect(cart.hasCartItemOutlet).toBe(false);
      expect(() => cart.cartItemOutlet).toThrowError(
        /Missing outlet element "cart-item"/
      );
    });

    it("should add value changed handlers to prototype", () => {
      const item = getController("item-1", "cart-item");
      const properties = Object.getOwnPropertyNames(item.constructor.prototype);
      expect(properties).toContain("priceValueChanged");
      expect(properties).toContain("quantityValueChanged");
    });

    it("should add outlet connected and disconnected handlers to prototype", () => {
      const cart = getController("cart", "cart");
      const properties = Object.getOwnPropertyNames(cart.constructor.prototype);
      expect(properties).toContain("cartItemOutletConnected");
      expect(properties).toContain("cartItemOutletDisconnected");
    });

    it("should add lifecycle and reactive methods to prototype", () => {
      const cart = getController("cart", "cart");
      const properties = Object.getOwnPropertyNames(cart.constructor.prototype);
      expect(properties).toEqual(
        expect.arrayContaining([
          "initialize",
          "disconnect",
          "effect",
          "computed",
        ])
      );
    });
  });

  it("should invoke lifecycle methods and callbacks", async () => {
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div id="parent" data-controller="debug" data-debug-debug-outlet="#child"></div>`
    );
    const parent = await waitForController<DebugController>("parent", "debug");

    parent.propertyValue = 1;
    await waitUntil(() => parent.propertyValue === 1);

    document.body.insertAdjacentHTML(
      "beforeend",
      `<div id="child"  data-controller="debug" data-debug-debug-outlet="#none"></div>`
    );
    await waitUntil(() => parent.debugOutlets.length > 0);

    document.querySelector("#child")!.remove();
    await waitUntil(() => parent.debugOutlets.length == 0);

    document.body.innerHTML = "";
    await waitUntil(() => parent.isDisconnected);

    expect(parent.logs).toEqual([
      "parent initialize",
      "parent value changed from undefined to 0",
      "parent connect",
      "parent value changed from 0 to 1",
      "child initialize",
      "child value changed from undefined to 0",
      "parent outlet connected",
      "child connect",
      "child disconnect",
      "parent outlet disconnected",
      "parent disconnect",
    ]);
  });
});
