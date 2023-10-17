[![version(scoped)](https://img.shields.io/npm/v/stimulus-reactive.svg)](https://www.npmjs.com/package/stimulus-reactive)
[![codecov](https://codecov.io/gh/ajaishankar/stimulus-reactive/graph/badge.svg?token=LJIR8JVZAN)](https://codecov.io/gh/ajaishankar/stimulus-reactive)

# Stimulus Reactive

### Reactivity for the Stimulus you already have

#### 🚀 View the [Shopping Cart Demo](https://ajaishankar.github.io/stimulus-reactive/) and the [Controllers](https://github.com/ajaishankar/stimulus-reactive/blob/main/docs/)

When you love the refreshing simplicity of Stimulus but miss the reactivity of other big frameworks.

A Stimulus application's [state lives in the DOM](https://stimulus.hotwired.dev/handbook/managing-state), but what if you could make that state reactive?

That is the core idea of Stimulus Reactive, a tiny library that brings the best of both worlds.

Stimulus Reactive automatically wires up `valueChanged`, `outletConnected` and `outletDisconnected` handlers and keeps some internal *reactive state* in sync with those changes.

On a state change, anything that depends on that state gets automatically updated!

In the following example:

When a cart item gets added or removed, or an existing item's quantity or price is updated
- The cart total will show the correct value
- The checkout button will be enabled or disabled based on the total.

In `effect` (pun intended) Stimulus Reactive allows you to *declaratively specify* the behavior of your controllers.

```js
class CartItemController extends Controller {
  static targets = ["total"];
  static values = {
    price: Number,
    quantity: { type: Number, default: 1 },
  };

  static afterLoad(identifier, application) {
    useStimulusReactive(identifier, application);
  }

  get total() {
    return this.priceValue * this.quantityValue;
  }

  connect() {
    // displayed total will be updated when price or quantity changes
    this.effect(() => (this.totalTarget.textContent = this.total.toString()));
  }
}

class CartController extends Controller {
  static targets = ["checkout", "cartTotal"];
  static outlets = ["cart-item"];

  static afterLoad(identifier, application) {
    useStimulusReactive(identifier, application);
  }

  get total() {
    return this.cartItemOutlets.reduce((total, item) => total + item.total, 0);
  }

  connect() {
    this.effect(() => {
      // text content is kept in sync with cart total
      this.cartTotalTarget.textContent = total.toString()
      // checkout button is enabled only when balance is due
      this.checkoutTarget.disabled = total == 0
    });

    // another effect for some other dependency
    this.effect(() => ...);
  }
}
```

### Usage

State lives in a controller's values and connected outlets.

1. Call `useStimulusReactive` in the static `afterLoad` method
2. In the `connect` lifecycle method specify controller behavior using `effect`s
3. Effects will run whenever any dependency changes  
   This will be familiar to those coming from other frameworks like React, Vue etc.

That's pretty much it!

### How does this work?

Under the hood Stimulus Reactive uses [@vue/reactivity](https://github.com/vuejs/core/tree/main/packages/reactivity) to do all the hard work.

Give it a go and hopefully this helps make your [majestic monolith](https://m.signalvnoise.com/the-majestic-monolith-29166d022228) sparkle!
