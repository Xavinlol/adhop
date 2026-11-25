import { SKIP_CLICK_TARGET } from "./youtube";

function asTrusted(event: Event): Event {
  return new Proxy(event, {
    get(target, property) {
      if (property === "isTrusted") return true;
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export function trustSkipClicks(): void {
  const { addEventListener, removeEventListener } = EventTarget.prototype;
  const wrappers = new WeakMap<EventListenerOrEventListenerObject, EventListener>();

  function wrap(listener: EventListenerOrEventListenerObject): EventListener {
    let wrapper = wrappers.get(listener);
    if (!wrapper) {
      wrapper = function (this: unknown, event) {
        const trusted = asTrusted(event);
        if (typeof listener === "function") {
          listener.call(this, trusted);
        } else {
          listener.handleEvent(trusted);
        }
      };
      wrappers.set(listener, wrapper);
    }
    return wrapper;
  }

  EventTarget.prototype.addEventListener = function (type, listener, options) {
    const isSkipClick = type === "click" && listener && this instanceof Element && this.matches(SKIP_CLICK_TARGET);
    addEventListener.call(this, type, isSkipClick ? wrap(listener) : listener, options);
  };

  EventTarget.prototype.removeEventListener = function (type, listener, options) {
    removeEventListener.call(this, type, listener, options);
    const wrapper = type === "click" && listener && wrappers.get(listener);
    if (wrapper) {
      removeEventListener.call(this, type, wrapper, options);
    }
  };
}
