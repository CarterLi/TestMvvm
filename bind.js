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
    const bindProperty = this.setOnewayToSourceBinding(elem, vm, expText);
    this.setOnewayBinding(elem, vm, bindProperty, expText);
  }

  setOnewayToSourceBinding(elem, vm, expText) {
    let bindProperty = 'value';
    let bindEvent = 'input';

    if (elem.tagName === 'INPUT') {
      switch (elem.type) {
      case 'number':
      case 'range':
        bindProperty = 'valueAsNumber';
        break;

      case 'month':
      case 'week':
      case 'time':
      case 'date':
      case 'datetime':
      case 'datetime-local':
        bindProperty = 'valueAsDate';
        break;

      case 'radio':
      case 'checkbox':
        bindProperty = 'checked';
        bindEvent = 'change';
        break;
      }
    }

    this.setEventBinding(elem, vm, bindEvent, `${expText} = $event.target.${bindProperty}`);

    return bindProperty;
  }

  setEventBinding(elem, vm, eventName, expText) {
    elem.addEventListener(eventName, function eventBindingExpression($event) {
      try {
        return this.call(vm, $event);
      } catch (e) {
        if (e instanceof SyntaxError) throw e;
        console.warn(e);
      }
    }.bind(new Function('$event', '"use strict";\n' + expText)));
  }

  setOnewayBinding(elem, vm, property, expText) {
    const expression = function onewayBindingExpression(property, vm) {
      try {
        elem[property] = this.call(vm);
      } catch (e) {
        if (e instanceof SyntaxError) throw e;
        console.warn(e);
        elem[property] = '';
      }
    }.bind(new Function('"use strict";\nreturn ' + expText), property);

    expression(vm);

    for (let match, regexp = /this(?:\.\w+)+/g; (match = regexp.exec(expText)); ) {
      Binder.pushOrSet(this.bindings, match[0].substr(5), expression);
    }
  }

  setRepeatBinding(elem, vm, property, expText) {
    const generatedElements = [];
    const expression = function repeatBindingExpression(property, vm) {
      try {
        generatedElements.length = 0;
        for (let value of this.call(vm)) {
          if (value != null) {
            const newNode = document.importNode(elem.content, true);
            generatedElements.push(newNode);

            switch (typeof value) {
            case 'object':
              if (Array.isArray(value)) {
                throw new Error('Unsupported yet');
              }
              
              // TODO
              break;

            case 'function':
            case 'symbol':
              throw new TypeError('Invalid');

            default:
              throw new Error('Unsupported yet');
            }
          }
        }
      } catch (e) {
        if (e instanceof SyntaxError) throw e;
        console.warn(e);
      }
    }.bind(new Function('"use strict";\nreturn ' + expText), property);

  }

  updateProperty(obj, prop) {
    const bindingExpressions = this.bindings[prop];
    if (bindingExpressions) {
      bindingExpressions.forEach(expression => expression(obj));
    }
  }

  startWatching(vm, prefix, root) {
    if (Array.isArray(vm)) {
      throw new Error('Array is not supported (yet)');
    } else {
      // We can't use const here or FF45 won't be happy
      for (let key in vm) {
        if (vm.hasOwnProperty(key)) {
          const value = vm[key];
          if (value != null && typeof value === 'object') {
            vm[key] = this.startWatching(value, `${prefix}${key}.`, root);
          }
        }
      }
    }

    return this.observeObject(vm, prefix, root);
  }

  setupEssential() {
    if (typeof Proxy !== 'undefined') {
      this.observeObject = function observeObject(vm, prefix, root) {
        const that = this;
        return new Proxy(vm, {
          set(obj, prop, value) {
            if (obj[prop] !== value) {
              obj[prop] = value;
              that.updateProperty(root, prefix + prop);
            }
            return true;
          }
        });
      };
    } else if (Object.observe) {
      this.observeObject = function observeObject(vm, prefix, root) {
        Object.observe(vm, changes => {
          changes.forEach(change => this.updateProperty(root, prefix + change.name));
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
    vm = this.startWatching(vm, '', vm);

    Array.prototype.forEach.call(root.querySelectorAll('*'), elem => {
      Object.keys(elem.dataset).forEach(key => {
        if (key === 'init') {
          new Function(elem.dataset[key]).call(vm);
        } else if (key === 'source') {
          this.setOnewayToSourceBinding(elem, vm, elem.dataset[key]);
        } else if (key === 'model') {
          this.setTwowayBinding(elem, vm, elem.dataset[key]);
        } else if (key === 'repeat' && elem.tagName === 'TEMPLATE') {
          this.setRepeatBinding(elem, vm, elem.dataset[key]);
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
