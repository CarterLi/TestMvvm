'use strict';

function pushOrSet(object, key, value) {
  if (key in object) {
    object[key].push(value);
  } else {
    object[key] = [value];
  }
}

function setTwowayBinding(elem, vm, expText, bindings) {
  vm[expText] = elem.value;

  elem.addEventListener('input', evt => {
    vm[expText] = elem.value;
  });
  
  pushOrSet(bindings, expText, function expression(vm) {
    elem.value = vm[expText];
  });
}

function setEventBinding(elem, vm, eventName, expText) {
  elem.addEventListener(eventName, function expression($event) {
    try {
      return this.call(vm, $event);
    } catch(e) {
      if (e instanceof SyntaxError) throw e;
    }
  }.bind(new Function('$event', expText)))
}

function setOnewayBinding(elem, vm, property, expText, bindings) {
  const expression = function expression(property, vm) {
    try {
      elem[property] = this.call(vm);
    } catch(e) {
      if (e instanceof SyntaxError) throw e;
      elem[property] = '';
    }
  }.bind(new Function('return ' + expText), property);

  expression(vm);

  for (var match, regexp = /this\.(\w*)/g; (match = regexp.exec(expText)); ) {
    pushOrSet(bindings, match[1], expression);
  }
}

function startWatching(vm, bindings) {
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
  const bindings = Object.create(null);
  
  Array.prototype.forEach.call(root.querySelectorAll('*'), elem => {
    Object.keys(elem.dataset).forEach(key => {
      if (key === 'model') {
        setTwowayBinding(elem, vm, elem.dataset[key], bindings);
      } else if (/^on[A-Z]*/.test(key)) {
        setEventBinding(elem, vm, key.slice(2).toLowerCase(), elem.dataset[key]);
      } else {
        setOnewayBinding(elem, vm, key === 'bind' ? 'textContent' : key, elem.dataset[key], bindings);
      }
    })
  });
  
  return startWatching(vm, bindings);
}
