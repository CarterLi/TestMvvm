'use strict';

void function polyfill() {
  if (!NodeList.prototype.forEach) {
    NodeList.prototype.forEach = Array.prototype.forEach;
  }
}();

function watch(root, vm) {
  root.querySelectorAll('[data-model]').forEach(elem => {
    vm[elem.dataset.model] = elem.value;

    elem.addEventListener('input', evt => {
     vm[elem.dataset.model] = elem.value;
    });
  })
  
  root.querySelectorAll('[data-click]').forEach(elem => {
    const expText = elem.dataset.click;
    elem.addEventListener('click', function expression($event) {
      try {
        return this.call(vm, $event);
      } catch(e) {
        if (e instanceof SyntaxError) throw e;
      }
    }.bind(new Function('$event', expText)))
  });

  return vm;
}

function bind(root, vm) {
  const bindings = Object.create(null);

  function pushOrSet(object, key, value) {
    if (key in object) {
      object[key].push(value);
    } else {
      object[key] = [value];
    }
  }

  root.querySelectorAll('[data-bind], [data-value]').forEach(elem => {
    if ('bind' in elem.dataset && 'value' in elem.dataset) {
      throw new Error('Conflicted binding attributes');
    }

    const expText = elem.dataset.bind || elem.dataset.value;
    const expression = function expression(property, vm) {
      try {
        elem[property] = this.call(vm);
      } catch(e) {
        if (e instanceof SyntaxError) throw e;
        elem[property] = '';
      }
    }.bind(new Function('return ' + expText), 'bind' in elem.dataset ? 'textContent' : 'value');

    expression(vm);

    for (var match, regexp = /this\.(\w*)/g; (match = regexp.exec(expText)); ) {
      pushOrSet(bindings, match[1], expression);
    }
  });

  root.querySelectorAll('[data-model]').forEach(elem => {
    pushOrSet(bindings, elem.dataset.model, function expression(vm) {
      elem.value = vm[elem.dataset.model];
    });
  });

  function updateProperty(obj, prop) {
    const bindingExpressions = bindings[prop];
    if (bindingExpressions) {
      bindingExpressions.forEach(expression => expression(obj));
    }
  }

  if (typeof Proxy !== 'undefined') {
    return new Proxy(vm, {
      set(obj, prop, value) {
        obj[prop] = value;
        updateProperty(obj, prop);
        return true;
      }
    });
  } else if (Object.observe) {
    Object.observe(vm, changes => {
      changes.forEach(change => updateProperty(change.object, change.name));
    });
    return vm;
  } else {
    throw new Error('Unsupported browser');
  }
}

function bootstrap(root, vm) {
  root = root || document;
  vm = vm || {};
  return watch(root, bind(root, vm));
}
