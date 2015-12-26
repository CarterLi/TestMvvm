'use strict';

class Binder {
  static pushOrSet(object, key, value) {
    if (key in object) {
      object[key].push(value);
    } else {
      object[key] = [value];
    }
  }

  setTwowayBinding(elem, vm, expText) {
    vm[expText] = elem.value;

    elem.addEventListener('input', () => {
      vm[expText] = elem.value;
    });

    Binder.pushOrSet(this.bindings, expText, function expression(vm) {
      elem.value = vm[expText];
    });
  }

  setEventBinding(elem, vm, eventName, expText) {
    elem.addEventListener(eventName, function expression($event) {
      try {
        return this.call(vm, $event);
      } catch (e) {
        if (e instanceof SyntaxError) throw e;
      }
    }.bind(new Function('$event', expText)));
  }

  setOnewayBinding(elem, vm, property, expText) {
    const expression = function expression(property, vm) {
      try {
        elem[property] = this.call(vm);
      } catch (e) {
        if (e instanceof SyntaxError) throw e;
        elem[property] = '';
      }
    }.bind(new Function('return ' + expText), property);

    expression(vm);

    for (let match, regexp = /this(?:\.\w+)+/g; (match = regexp.exec(expText)); ) {
      Binder.pushOrSet(this.bindings, match[0].substr(5), expression);
    }
  }

  updateProperty(obj, prop) {
    const bindingExpressions = this.bindings[prop];
    if (bindingExpressions) {
      bindingExpressions.forEach(expression => expression(obj));
    }
  }

  startWatching(vm, prefix) {
    if (Array.isArray(vm)) {
      throw new Error('Array is not supported (yet)');
    } else {
      for (const key in vm) {
        if (vm.hasOwnProperty(key)) {
          const value = vm[key];
          if (value != null && typeof value === 'object') {
            this.startWatching(value, `${prefix}${key}.`);
          }
        }
      }
    }

    return this.observeObject(vm, prefix);
  }

  setupEssential() {
    if (typeof Proxy !== 'undefined') {
      this.observeObject = function observeObject(vm, prefix) {
        const that = this;
        return new Proxy(vm, {
          set(obj, prop, value) {
            if (obj[prop] !== value) {
              obj[prop] = value;
              that.updateProperty(obj, prefix + prop);
            }
            return true;
          }
        });
      };
    } else if (Object.observe) {
      this.observeObject = function observeObject(vm, prefix) {
        Object.observe(vm, changes => {
          changes.forEach(change => this.updateProperty(change.object, prefix + change.name));
        });
        return vm;
      };
    } else {
      throw new Error('Unsupported browser');
    }
  }

  constructor(root, vm) {
    this.setupEssential();
    this.bindings = Object.create(null);
    vm = this.startWatching(vm, '');

    Array.prototype.forEach.call(root.querySelectorAll('*'), elem => {
      Object.keys(elem.dataset).forEach(key => {
        if (key === 'init') {
          new Function(elem.dataset[key]).call(vm);
        } else if (key === 'model') {
          this.setTwowayBinding(elem, vm, elem.dataset[key]);
        } else if (/^on[A-Z]/.test(key)) {
          this.setEventBinding(elem, vm, key.slice(2).toLowerCase(), elem.dataset[key]);
        } else {
          this.setOnewayBinding(elem, vm, key === 'bind' ? 'textContent' : key, elem.dataset[key]);
        }
      });
    });

    this.viewModel = vm;
  }
}

window.bootstrap = function bootstrap(root, vm) {
  return new Binder(root, vm).viewModel;
};
