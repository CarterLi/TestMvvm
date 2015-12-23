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
        elem[property] = this.call(vm)
      } catch(e) {
        if (e instanceof SyntaxError) throw e;
        elem[property] = '';
      }
    }.bind(new Function('return ' + expText), 'bind' in elem.dataset ? 'textContent' : 'value');

    expression(vm);

    for (let match, regexp = /this\.(\w*)/g; (match = regexp.exec(expText)); ) {
      pushOrSet(bindings, match[1], expression);
    }
  });

  root.querySelectorAll('[data-model]').forEach(elem => {
    pushOrSet(bindings, elem.dataset.model, function expression(vm) {
      elem.value = vm[elem.dataset.model]
    });
  });

  return new Proxy(vm, {
    set(obj, prop, value) {
      obj[prop] = value;
      const bindingExpressions = bindings[prop];
      if (bindingExpressions) {
        bindingExpressions.forEach(expression => expression(obj));
      }
      return true;
    }
  })
}

function bootstrap(root = document, vm = {}) {
  return watch(root, bind(root, vm));
}
