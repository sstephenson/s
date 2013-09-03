(function() {
  var Arguments, Atom, BinaryOp, Boolean, BooleanOp, Closure, Continuation, Environment, Frame, Interpreter, Number, Pair, Procedure, String, Symbol, TypePred, Value, map, parse, parseArray, parseValue, prelude, run, _ref, _ref1, _ref2, _ref3, _ref4, _ref5, _ref6,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Atom = (function() {
    function Atom() {}

    Atom.prototype.isNotNull = function() {
      return true;
    };

    Atom.prototype.isNull = function() {
      return !this.isNotNull();
    };

    Atom.prototype.apply = function(frame) {
      return frame.raiseError("can't apply " + this.constructor.name);
    };

    Atom.prototype["eval"] = function(frame) {
      return frame.returnValue(this);
    };

    Atom.prototype.eq = function(atom) {
      return this === atom;
    };

    Atom.prototype.eqv = function(atom) {
      return this.eq(atom);
    };

    Atom.prototype.isA = function(type) {
      return this.constructor === type;
    };

    Atom.prototype.toString = function() {
      return this.inspect();
    };

    return Atom;

  })();

  Value = (function(_super) {
    __extends(Value, _super);

    function Value(value) {
      this.value = value;
    }

    Value.prototype.eqv = function(atom) {
      return Value.__super__.eqv.apply(this, arguments) || this.constructor === atom.constructor && this.value === atom.value;
    };

    Value.prototype.inspect = function() {
      return this.value.toString();
    };

    return Value;

  })(Atom);

  Boolean = (function(_super) {
    __extends(Boolean, _super);

    function Boolean() {
      _ref = Boolean.__super__.constructor.apply(this, arguments);
      return _ref;
    }

    return Boolean;

  })(Value);

  String = (function(_super) {
    __extends(String, _super);

    function String() {
      _ref1 = String.__super__.constructor.apply(this, arguments);
      return _ref1;
    }

    String.prototype.inspect = function() {
      return "\"" + (this.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')) + "\"";
    };

    String.prototype.toString = function() {
      return this.value;
    };

    String.prototype.append = function(value) {
      return new this.constructor(this.value + value.toString());
    };

    return String;

  })(Value);

  Symbol = (function(_super) {
    __extends(Symbol, _super);

    function Symbol() {
      _ref2 = Symbol.__super__.constructor.apply(this, arguments);
      return _ref2;
    }

    Symbol.symbols = {};

    Symbol.fromString = function(string) {
      var _base;
      return (_base = this.symbols)[string] != null ? (_base = this.symbols)[string] : _base[string] = new this(string);
    };

    Symbol.prototype["eval"] = function(frame) {
      var value;
      if (value = frame.env.get(this.value)) {
        return frame.returnValue(value);
      } else {
        return frame.raiseError("unbound variable `" + this.value + "'");
      }
    };

    Symbol.prototype.inspect = function() {
      return this.value.toString();
    };

    return Symbol;

  })(String);

  Number = (function(_super) {
    __extends(Number, _super);

    function Number() {
      _ref3 = Number.__super__.constructor.apply(this, arguments);
      return _ref3;
    }

    Number.prototype.add = function(number) {
      return new this.constructor(this.value + number.value);
    };

    Number.prototype.subtract = function(number) {
      return new this.constructor(this.value - number.value);
    };

    Number.prototype.multiply = function(number) {
      return new this.constructor(this.value * number.value);
    };

    Number.prototype.divide = function(number) {
      return new this.constructor(this.value / number.value);
    };

    Number.prototype.modulo = function(number) {
      return new this.constructor(this.value % number.value);
    };

    Number.prototype.gt = function(number) {
      return this.value > number.value;
    };

    Number.prototype.lt = function(number) {
      return this.value < number.value;
    };

    Number.prototype.gte = function(number) {
      return this.value >= number.value;
    };

    Number.prototype.lte = function(number) {
      return this.value <= number.value;
    };

    return Number;

  })(Value);

  Pair = (function(_super) {
    __extends(Pair, _super);

    Pair.fromArray = function(values) {
      var result, value, _i;
      result = new this;
      for (_i = values.length - 1; _i >= 0; _i += -1) {
        value = values[_i];
        result = new this(value, result);
      }
      return result;
    };

    function Pair(car, cdr) {
      this.car = car;
      this.cdr = cdr;
    }

    Pair.prototype["eval"] = function(frame) {
      if (this.isNotNull()) {
        return frame.extend({
          exp: this.car,
          fn: this.car["eval"]
        })["continue"]({
          exp: this,
          fn: this.eval1
        });
      } else {
        return frame.returnValue(new this.constructor);
      }
    };

    Pair.prototype.eval1 = function(frame) {
      return frame.val.apply(frame, this.cdr);
    };

    Pair.prototype.eq = function(atom) {
      return Pair.__super__.eq.apply(this, arguments) || this.isNull() && atom.isNull();
    };

    Pair.prototype.isNotNull = function() {
      return (this.car != null) || (this.cdr != null);
    };

    Pair.prototype.append = function(value) {
      var values;
      values = this.toArray();
      if (value instanceof this.constructor) {
        values = values.concat(value.toArray());
      } else {
        values.push(value);
      }
      return this.constructor.fromArray(values);
    };

    Pair.prototype.reverse = function() {
      var pair, result;
      pair = this;
      result = null;
      while (pair != null ? pair.isNotNull() : void 0) {
        if (pair instanceof this.constructor) {
          result = new this.constructor(pair.car, result);
          pair = pair.cdr;
        } else {
          result = new this.constructor(pair, result);
          pair = null;
        }
      }
      return result != null ? result : new this.constructor;
    };

    Pair.prototype.isQuote = function() {
      var _ref4;
      return this.car instanceof Symbol && this.car.toString() === "'" && ((_ref4 = this.cdr) != null ? _ref4.isNotNull() : void 0);
    };

    Pair.prototype.inspect = function() {
      var car, cdr, pair, result;
      if (this.isQuote()) {
        return "'" + (this.cdr.car.inspect());
      }
      pair = this;
      result = [];
      while (pair != null ? pair.isNotNull() : void 0) {
        car = pair.car, cdr = pair.cdr;
        result.push(car.inspect());
        if (cdr != null ? cdr.isNotNull() : void 0) {
          if (cdr instanceof this.constructor) {
            pair = cdr;
          } else {
            result.push(".", cdr.inspect());
            break;
          }
        } else {
          break;
        }
      }
      return "(" + (result.join(" ")) + ")";
    };

    Pair.prototype.toArray = function() {
      var car, cdr, pair, values;
      pair = this;
      values = [];
      while (pair != null ? pair.isNotNull() : void 0) {
        car = pair.car, cdr = pair.cdr;
        values.push(car);
        pair = cdr instanceof this.constructor ? cdr : null;
      }
      return values;
    };

    return Pair;

  })(Atom);

  Procedure = (function(_super) {
    __extends(Procedure, _super);

    function Procedure(name, value) {
      this.name = name;
      this.value = value;
    }

    Procedure.prototype.apply = function(frame, args) {
      return this.value(frame, args);
    };

    Procedure.prototype.isA = function(type) {
      return this instanceof type;
    };

    Procedure.prototype.inspect = function() {
      return "#<Procedure: " + this.name + ">";
    };

    return Procedure;

  })(Atom);

  BinaryOp = (function(_super) {
    var apply1, apply2;

    __extends(BinaryOp, _super);

    function BinaryOp() {
      _ref4 = BinaryOp.__super__.constructor.apply(this, arguments);
      return _ref4;
    }

    BinaryOp.prototype.apply = function(frame, args) {
      if (args.car) {
        return frame["eval"](args.car, {
          exp: args.cdr,
          fn: apply1,
          ctx: this
        });
      } else {
        return frame.raiseError("`" + this.name + "' expects 2 arguments");
      }
    };

    apply1 = function(frame) {
      var args;
      args = frame.exp;
      if (args.car) {
        return frame["eval"](args.car, {
          exp: frame.val,
          fn: apply2,
          ctx: this
        });
      } else {
        return frame.raiseError("`" + this.name + "' expects 2 arguments");
      }
    };

    apply2 = function(frame) {
      var a, b;
      a = frame.exp;
      b = frame.val;
      if (a.constructor === b.constructor) {
        return this.compute(frame, a, b);
      } else {
        return frame.raiseError("`" + this.name + "' argument type mismatch");
      }
    };

    BinaryOp.prototype.compute = function(frame, a, b) {
      var fn;
      if (fn = a[this.value]) {
        return frame.returnValue(fn.call(a, b));
      } else {
        return frame.raiseError("`" + this.name + "' not supported");
      }
    };

    return BinaryOp;

  })(Procedure);

  BooleanOp = (function(_super) {
    __extends(BooleanOp, _super);

    function BooleanOp() {
      _ref5 = BooleanOp.__super__.constructor.apply(this, arguments);
      return _ref5;
    }

    BooleanOp.prototype.compute = function(frame, a, b) {
      var fn;
      if (fn = a[this.value]) {
        return frame.returnBoolean(fn.call(a, b));
      } else {
        return frame.raiseError("`" + this.name + "' not supported");
      }
    };

    return BooleanOp;

  })(BinaryOp);

  TypePred = (function(_super) {
    var apply1;

    __extends(TypePred, _super);

    function TypePred() {
      _ref6 = TypePred.__super__.constructor.apply(this, arguments);
      return _ref6;
    }

    TypePred.prototype.apply = function(frame, args) {
      if (args.car) {
        return frame["eval"](args.car, {
          exp: args.cdr,
          fn: apply1,
          ctx: this
        });
      } else {
        return frame.raiseError("`" + this.name + "' expects 1 argument");
      }
    };

    apply1 = function(frame) {
      return frame.returnBoolean(frame.val.isA(this.value));
    };

    return TypePred;

  })(Procedure);

  Closure = (function(_super) {
    var apply1;

    __extends(Closure, _super);

    function Closure(args, body, env) {
      this.body = body;
      this.env = env;
      this.args = new Arguments(args);
    }

    Closure.prototype.apply = function(frame, args) {
      return frame.extend({
        exp: args,
        fn: map,
        val: null
      })["continue"]({
        val: new Pair,
        env: this.env.extend(),
        fn: apply1,
        ctx: this
      });
    };

    apply1 = function(frame) {
      return this.args.apply(frame, frame.val, {
        exp: this.body,
        fn: run
      });
    };

    Closure.prototype.inspect = function() {
      return "#<Closure: " + (this.args.inspect()) + ">";
    };

    return Closure;

  })(Atom);

  Continuation = (function(_super) {
    var apply1;

    __extends(Continuation, _super);

    function Continuation(frame) {
      this.frame = frame;
    }

    Continuation.prototype.apply = function(frame, args) {
      if (args.car) {
        return frame["eval"](args.car, {
          fn: apply1,
          ctx: this
        });
      } else {
        return frame.raiseError("continuation expects 1 argument");
      }
    };

    apply1 = function(frame) {
      return this.frame.extend({
        ctx: this.frame.ctx,
        val: frame.val
      });
    };

    Continuation.prototype.inspect = function() {
      return "#<Continuation>";
    };

    return Continuation;

  })(Atom);

  Arguments = (function() {
    function Arguments(definition) {
      var arg, name;
      this.definition = definition;
      this.carNames = [];
      arg = definition;
      while (arg != null ? arg.isNotNull() : void 0) {
        if (arg instanceof Symbol) {
          this.cdrName = arg.toString();
          break;
        } else if (arg instanceof Pair) {
          name = arg.car;
          if (name instanceof Symbol) {
            this.carNames.push(name.toString());
            arg = arg.cdr;
          } else {
            throw "syntax error";
          }
        } else {
          throw "syntax error";
        }
      }
      this.arity = this.carNames.length;
      if (this.cdrName) {
        this.arity = -(this.arity + 1);
      }
    }

    Arguments.prototype.apply = function(frame, values, registers) {
      var argName, arity, value, _i, _len, _ref7;
      if (this.arity !== 0) {
        value = values;
        _ref7 = this.carNames;
        for (_i = 0, _len = _ref7.length; _i < _len; _i++) {
          argName = _ref7[_i];
          if ((value != null ? value.isNotNull() : void 0) && value.car) {
            frame.env.define(argName, value.car);
            value = value.cdr;
          } else {
            arity = this.arity < 0 ? -this.arity - 1 : this.arity;
            return frame.raiseError("expected " + [this.arity < 0 ? "at least " : void 0] + arity + " argument" + [arity !== 1 ? "s" : void 0]);
          }
        }
        if (this.cdrName) {
          frame.env.define(this.cdrName, value != null ? value : new Pair);
        }
      }
      return frame.extend(registers);
    };

    Arguments.prototype.inspect = function() {
      return this.definition.inspect();
    };

    return Arguments;

  })();

  Environment = (function() {
    function Environment(parent) {
      this.parent = parent;
      this.values = {};
    }

    Environment.prototype.define = function(name, value) {
      return this.values[name] = value;
    };

    Environment.prototype.set = function(name, value) {
      var environment;
      environment = this;
      while (environment) {
        if ((environment.values[name] != null) || !environment.parent) {
          return environment.values[name] = value;
        }
        environment = environment.parent;
      }
    };

    Environment.prototype.get = function(name) {
      var environment, value;
      environment = this;
      while (environment) {
        value = environment.values[name];
        if (value != null) {
          return value;
        }
        environment = environment.parent;
      }
    };

    Environment.prototype.extend = function() {
      return new this.constructor(this);
    };

    Environment.prototype.keys = function() {
      return Object.keys(this.values);
    };

    Environment.prototype.inspect = function() {
      if (this.parent) {
        return "{" + (this.keys().concat(this.parent.inspect()).join(", ")) + "}";
      } else {
        return "{<global>}";
      }
    };

    return Environment;

  })();

  Frame = (function() {
    function Frame(interpreter, _arg) {
      var _ref7;
      this.interpreter = interpreter;
      _ref7 = _arg != null ? _arg : {}, this.env = _ref7.env, this.exp = _ref7.exp, this.cont = _ref7.cont, this.val = _ref7.val, this.fn = _ref7.fn, this.ctx = _ref7.ctx;
      if (this.env == null) {
        this.env = interpreter.env;
      }
    }

    Frame.prototype.apply = function() {
      var _ref7;
      if (this.fn) {
        return {
          cont: this.fn.call((_ref7 = this.ctx) != null ? _ref7 : this.exp, this)
        };
      } else {
        return {
          val: this.val
        };
      }
    };

    Frame.prototype.dup = function() {
      return this.extend({
        ctx: this.ctx
      });
    };

    Frame.prototype.extend = function(registers) {
      if (registers == null) {
        registers = {};
      }
      return new this.constructor(this.interpreter, {
        env: "env" in registers ? registers.env : this.env,
        exp: "exp" in registers ? registers.exp : this.exp,
        cont: "cont" in registers ? registers.cont : this.cont,
        val: "val" in registers ? registers.val : this.val,
        fn: "fn" in registers ? registers.fn : this.fn,
        ctx: "ctx" in registers ? registers.ctx : void 0
      });
    };

    Frame.prototype["continue"] = function(registers, continuationRegisters) {
      var cont, _base;
      if (continuationRegisters == null) {
        continuationRegisters = {};
      }
      cont = this.extend(registers);
      cont.cont = this.cont.extend(continuationRegisters);
      if ((_base = cont.cont).ctx == null) {
        _base.ctx = this.cont.ctx;
      }
      this.cont = cont;
      return this;
    };

    Frame.prototype["eval"] = function(exp, registers, continuationRegisters) {
      return this.extend({
        exp: exp,
        fn: exp["eval"]
      })["continue"](registers, continuationRegisters);
    };

    Frame.prototype.returnValue = function(value) {
      this.cont.val = value;
      return this.cont;
    };

    Frame.prototype.returnBoolean = function(value) {
      return this.returnValue(value ? this.interpreter.t : this.interpreter.f);
    };

    Frame.prototype.raiseError = function(error) {
      throw error;
    };

    return Frame;

  })();

  Interpreter = (function() {
    var and0, and1, and2, append, append1, append2, apply, apply1, apply2, begin, callcc, callcc1, car, car1, cdr, cdr1, cons, cons1, cons2, define, define1, eqp, eqp1, eqp2, eqvp, eqvp1, eqvp2, if0, if1, lambda, let0, letrec, not0, not1, nullp, nullp1, or0, or1, or2, quote, set, set1, string, string1, string2, symbol, symbol1, symbol2, trampoline, _ref7;

    function Interpreter() {
      this.env = new Environment;
      this.env.define("#f", this.f = new Boolean("#f"));
      this.env.define("#t", this.t = new Boolean("#t"));
      this.env.define("and", new Procedure("and", and0));
      this.env.define("append", new Procedure("append", append));
      this.env.define("apply", new Procedure("apply", apply));
      this.env.define("begin", new Procedure("begin", begin));
      this.env.define("boolean?", new TypePred("boolean?", Boolean));
      this.env.define("call/cc", new Procedure("call/cc", callcc));
      this.env.define("car", new Procedure("car", car));
      this.env.define("cdr", new Procedure("cdr", cdr));
      this.env.define("cons", new Procedure("cons", cons));
      this.env.define("define", new Procedure("define", define));
      this.env.define("eq?", new Procedure("eq?", eqp));
      this.env.define("eqv?", new Procedure("eqv?", eqvp));
      this.env.define("if", new Procedure("if", if0));
      this.env.define("lambda", new Procedure("lambda", lambda));
      this.env.define("let", new Procedure("let", let0));
      this.env.define("letrec", new Procedure("letrec", letrec));
      this.env.define("not", new Procedure("not", not0));
      this.env.define("null?", new Procedure("null?", nullp));
      this.env.define("number?", new TypePred("number?", Number));
      this.env.define("or", new Procedure("or", or0));
      this.env.define("pair?", new TypePred("pair?", Pair));
      this.env.define("procedure?", new TypePred("procedure?", Procedure));
      this.env.define("quote", new Procedure("quote", quote));
      this.env.define("set!", new Procedure("set!", set));
      this.env.define("string", new Procedure("string", string));
      this.env.define("string?", new TypePred("string?", String));
      this.env.define("symbol", new Procedure("symbol", symbol));
      this.env.define("symbol?", new TypePred("symbol?", Symbol));
      this.env.define("+", new BinaryOp("+", "add"));
      this.env.define("-", new BinaryOp("-", "subtract"));
      this.env.define("*", new BinaryOp("*", "multiply"));
      this.env.define("/", new BinaryOp("/", "divide"));
      this.env.define("%", new BinaryOp("%", "modulo"));
      this.env.define("=", new BooleanOp("=", "eqv"));
      this.env.define(">", new BooleanOp(">", "gt"));
      this.env.define("<", new BooleanOp("<", "lt"));
      this.env.define(">=", new BooleanOp(">=", "gte"));
      this.env.define("<=", new BooleanOp("<=", "lte"));
      this.run(prelude, function() {});
    }

    Interpreter.prototype.run = function(program, callback, result) {
      var value,
        _this = this;
      if (value = program[0]) {
        return this["eval"](value, function(err, result) {
          if (err) {
            return callback(err);
          } else {
            return _this.run(program.slice(1), callback, result);
          }
        });
      } else {
        return callback(null, result);
      }
    };

    Interpreter.prototype["eval"] = function(value, callback) {
      var end, run;
      end = new Frame(this);
      run = new Frame(this, {
        exp: value,
        fn: value["eval"],
        cont: end
      });
      return trampoline(new Date, callback, {
        cont: run
      });
    };

    trampoline = function(date, callback, bounce) {
      var error, _results;
      _results = [];
      while (bounce) {
        if (bounce.val) {
          callback(null, bounce.val);
          break;
        } else if (new Date - date > 100) {
          setTimeout((function() {
            return trampoline(new Date, callback, bounce);
          }), 0);
          break;
        } else {
          try {
            _results.push(bounce = bounce.cont.apply());
          } catch (_error) {
            error = _error;
            callback(error, null);
            break;
          }
        }
      }
      return _results;
    };

    and0 = function(frame, args) {
      return frame.extend({
        exp: args,
        fn: and1,
        val: frame.interpreter.t
      });
    };

    and1 = function(frame) {
      if (frame.exp.car) {
        return frame["eval"](frame.exp.car, {
          exp: frame.exp.cdr,
          fn: and2
        });
      } else {
        return frame.returnValue(frame.val);
      }
    };

    and2 = function(frame) {
      if (frame.val === frame.interpreter.f) {
        return frame.returnValue(frame.val);
      } else {
        return and1(frame);
      }
    };

    append = function(frame, args) {
      return frame.extend({
        exp: args,
        fn: append1,
        val: new Pair
      });
    };

    append1 = function(frame) {
      var _ref7;
      if ((_ref7 = frame.exp) != null ? _ref7.isNotNull() : void 0) {
        return frame["eval"](frame.exp.car, {
          exp: frame.exp.cdr,
          fn: append2
        }, {
          val: frame.val
        });
      } else {
        return frame.returnValue(frame.val);
      }
    };

    append2 = function(frame) {
      return frame.extend({
        val: frame.cont.val.append(frame.val),
        fn: append1
      });
    };

    apply = function(frame, args) {
      if (args.car) {
        return frame["eval"](args.car, {
          exp: args.cdr,
          fn: apply1
        });
      } else {
        return frame.raiseError("`apply' expects 2 arguments");
      }
    };

    apply1 = function(frame) {
      if (frame.exp.car) {
        return frame["eval"](frame.exp.car, {
          fn: apply2,
          exp: frame.val
        });
      } else {
        return frame.raiseError("`apply' expects 2 arguments");
      }
    };

    apply2 = function(frame) {
      if (frame.val instanceof Pair) {
        return frame.exp.apply(frame, frame.val);
      } else {
        return frame.raiseError("`apply' second argument must be a list");
      }
    };

    begin = function(frame, args) {
      return frame.extend({
        exp: args,
        env: frame.env.extend(),
        fn: run,
        val: new Pair
      });
    };

    callcc = function(frame, args) {
      if (args.car) {
        return frame["eval"](args.car, {
          fn: callcc1
        });
      } else {
        return frame.raiseError("`call/cc' expects 1 argument");
      }
    };

    callcc1 = function(frame) {
      var cont;
      cont = new Continuation(frame.cont.dup());
      return frame.val.apply(frame, new Pair(cont));
    };

    car = function(frame, args) {
      if (args.car) {
        return frame["eval"](args.car, {
          fn: car1
        });
      } else {
        return frame.raiseError("`car' expects a pair argument");
      }
    };

    car1 = function(frame) {
      var _ref7;
      if (frame.val instanceof Pair) {
        return frame.returnValue((_ref7 = frame.val.car) != null ? _ref7 : new Pair);
      } else {
        return frame.raiseError("`car' expects a pair argument");
      }
    };

    cdr = function(frame, args) {
      if (args.car) {
        return frame["eval"](args.car, {
          fn: cdr1
        });
      } else {
        return frame.raiseError("`cdr' expects a pair argument");
      }
    };

    cdr1 = function(frame) {
      var _ref7;
      if (frame.val instanceof Pair) {
        return frame.returnValue((_ref7 = frame.val.cdr) != null ? _ref7 : new Pair);
      } else {
        return frame.raiseError("`cdr' expects a pair argument");
      }
    };

    cons = function(frame, args) {
      if (args.car) {
        return frame["eval"](args.car, {
          exp: args.cdr,
          fn: cons1
        });
      } else {
        return frame.raiseError("`cons' expects 2 arguments");
      }
    };

    cons1 = function(frame) {
      var args;
      args = frame.exp;
      if (args.car) {
        return frame["eval"](args.car, {
          fn: cons2
        }, {
          val: new Pair(frame.val)
        });
      } else {
        return frame.raiseError("`cons' expects 2 arguments");
      }
    };

    cons2 = function(frame) {
      var pair;
      pair = frame.cont.val;
      pair.cdr = frame.val;
      return frame.cont;
    };

    define = function(frame, args) {
      var arg, body, closure, error, name;
      if (args.car) {
        arg = args.car;
        if (arg instanceof Pair) {
          name = arg.car;
          if (body = args.cdr) {
            try {
              closure = new Closure(arg.cdr, body, frame.env);
              return define1(frame.extend({
                exp: name,
                val: closure
              }));
            } catch (_error) {
              error = _error;
              return frame.raiseError(error);
            }
          }
        } else if (args.cdr instanceof Pair && args.cdr.isNotNull()) {
          return frame["eval"](args.cdr.car, {
            exp: arg,
            fn: define1
          });
        }
      }
      return frame.raiseError("`define' expects 2 arguments");
    };

    define1 = function(frame) {
      var name, value;
      name = frame.exp;
      value = frame.val;
      if (name instanceof Symbol) {
        return frame.returnValue(frame.env.define(name.toString(), value));
      } else {
        return frame.raiseError("`define' name argument must be a symbol");
      }
    };

    eqp = function(frame, args) {
      if (args.car) {
        return frame["eval"](args.car, {
          exp: args.cdr,
          fn: eqp1
        });
      } else {
        return frame.raiseError("`eq?' expects 2 arguments");
      }
    };

    eqp1 = function(frame) {
      var args;
      args = frame.exp;
      if (args.car) {
        return frame["eval"](args.car, {
          exp: frame.val,
          fn: eqp2
        });
      } else {
        return frame.raiseError("`eq?' expects 2 arguments");
      }
    };

    eqp2 = function(frame) {
      var a, b;
      a = frame.exp;
      b = frame.val;
      return frame.returnBoolean(a.eq(b));
    };

    eqvp = function(frame, args) {
      if (args.car) {
        return frame["eval"](args.car, {
          exp: args.cdr,
          fn: eqvp1
        });
      } else {
        return frame.raiseError("`eqv?' expects 2 arguments");
      }
    };

    eqvp1 = function(frame) {
      var args;
      args = frame.exp;
      if (args.car) {
        return frame["eval"](args.car, {
          exp: frame.val,
          fn: eqvp2
        });
      } else {
        return frame.raiseError("`eqv?' expects 2 arguments");
      }
    };

    eqvp2 = function(frame) {
      var a, b;
      a = frame.exp;
      b = frame.val;
      return frame.returnBoolean(a.eqv(b));
    };

    if0 = function(frame, args) {
      if (args.car) {
        return frame["eval"](args.car, {
          exp: args.cdr,
          fn: if1
        });
      } else {
        return frame.raiseError("`if' expects 2 or 3 arguments");
      }
    };

    if1 = function(frame) {
      var args, exp, val;
      args = frame.exp;
      val = frame.val;
      if (args.car) {
        if (val === frame.interpreter.f) {
          if (args.cdr && args.cdr instanceof Pair) {
            exp = args.cdr.car;
            return frame.extend({
              exp: exp,
              fn: exp["eval"]
            });
          } else {
            return frame.returnValue(val);
          }
        } else {
          exp = args.car;
          return frame.extend({
            exp: exp,
            fn: exp["eval"]
          });
        }
      } else {
        return frame.raiseError("`if' expects 2 or 3 arguments");
      }
    };

    lambda = function(frame, args) {
      if (args.car && args.cdr instanceof Pair) {
        return frame.returnValue(new Closure(args.car, args.cdr, frame.env));
      } else {
        return frame.raiseError("`lambda' expects at least 2 arguments");
      }
    };

    not0 = function(frame, args) {
      if (args.car) {
        return frame["eval"](args.car, {
          fn: not1
        });
      } else {
        return frame.raiseError("`not' expects 1 argument");
      }
    };

    not1 = function(frame) {
      return frame.returnBoolean(frame.val === frame.interpreter.f);
    };

    nullp = function(frame, args) {
      if (args.car) {
        return frame["eval"](args.car, {
          fn: nullp1
        });
      } else {
        return frame.raiseError("`null?' expects 1 argument");
      }
    };

    nullp1 = function(frame) {
      var _ref7;
      return frame.returnBoolean(!((_ref7 = frame.val) != null ? _ref7.isNotNull() : void 0));
    };

    or0 = function(frame, args) {
      return frame.extend({
        exp: args,
        fn: or1,
        val: frame.interpreter.f
      });
    };

    or1 = function(frame) {
      if (frame.exp.car) {
        return frame["eval"](frame.exp.car, {
          exp: frame.exp.cdr,
          fn: or2
        });
      } else {
        return frame.returnValue(frame.val);
      }
    };

    or2 = function(frame) {
      if (frame.val === frame.interpreter.f) {
        return or1(frame);
      } else {
        return frame.returnValue(frame.val);
      }
    };

    quote = function(frame, args) {
      return frame.returnValue(args.car);
    };

    set = function(frame, args) {
      var name;
      if (args.car && args.cdr instanceof Pair && args.cdr.isNotNull()) {
        name = args.car;
        if (name instanceof Symbol) {
          return frame["eval"](args.cdr.car, {
            fn: set1
          }, {
            val: name
          });
        } else {
          return frame.raiseError("first argument of `set!' must be a symbol");
        }
      } else {
        return frame.raiseError("`set!' expects 2 arguments");
      }
    };

    set1 = function(frame) {
      var name, value;
      name = frame.cont.val.toString();
      value = frame.val;
      return frame.returnValue(frame.env.set(name, value));
    };

    string = function(frame, args) {
      return frame.extend({
        val: new String(""),
        exp: args,
        fn: string1
      });
    };

    string1 = function(frame) {
      var _ref7;
      if ((_ref7 = frame.exp) != null ? _ref7.isNotNull() : void 0) {
        return frame["eval"](frame.exp.car, {
          exp: frame.exp.cdr,
          fn: string2
        }, {
          val: frame.val
        });
      } else {
        return frame.returnValue(frame.val);
      }
    };

    string2 = function(frame) {
      return frame.extend({
        val: frame.cont.val.append(frame.val),
        fn: string1
      });
    };

    symbol = function(frame, args) {
      return frame.extend({
        val: new Symbol(""),
        exp: args,
        fn: symbol1
      });
    };

    symbol1 = function(frame) {
      var _ref7;
      if ((_ref7 = frame.exp) != null ? _ref7.isNotNull() : void 0) {
        return frame["eval"](frame.exp.car, {
          exp: frame.exp.cdr,
          fn: symbol2
        }, {
          val: frame.val
        });
      } else {
        return frame.returnValue(frame.val);
      }
    };

    symbol2 = function(frame) {
      return frame.extend({
        val: frame.cont.val.append(frame.val),
        fn: symbol1
      });
    };

    _ref7 = (function() {
      var letDummy, letSet, parseLetExpression;
      letDummy = new Atom;
      letSet = new Procedure("set!", set);
      parseLetExpression = function(args) {
        var binding, bindings, body, error, name, names, value, values, _ref7, _ref8;
        bindings = (_ref7 = args.car) != null ? _ref7 : new Pair;
        body = (_ref8 = args.cdr) != null ? _ref8 : new Pair;
        names = new Pair;
        values = new Pair;
        error = null;
        while (bindings) {
          if (bindings instanceof Pair) {
            binding = bindings.car;
            bindings = bindings.cdr;
            if (binding instanceof Pair && binding.cdr instanceof Pair) {
              name = binding.car;
              value = binding.cdr.car;
              if (name instanceof Symbol) {
                names = new Pair(name, names);
                values = new Pair(value, values);
              } else if (error = name) {
                break;
              }
            } else if (error = binding) {
              break;
            }
          } else if (error = bindings) {
            break;
          }
        }
        return {
          error: error,
          names: names,
          values: values,
          body: body
        };
      };
      return {
        let0: function(frame, args) {
          var closure, exp, pair;
          exp = parseLetExpression(args);
          if (exp.error) {
            return frame.raiseError("`let' binding `" + (exp.error.inspect()) + "': syntax is invalid");
          }
          closure = new Closure(exp.names, exp.body, frame.env.extend());
          pair = new Pair(closure, exp.values);
          return frame.extend({
            exp: pair,
            fn: pair["eval"]
          });
        },
        letrec: function(frame, args) {
          var body, env, exp, names, values;
          exp = parseLetExpression(args);
          if (exp.error) {
            return frame.raiseError("`letrec' binding `" + (exp.error.inspect()) + "': syntax is invalid");
          }
          env = frame.env.extend();
          names = exp.names, values = exp.values, body = exp.body;
          while (names != null ? names.car : void 0) {
            env.define(names.car.toString(), letDummy);
            set = new Pair(letSet, new Pair(names.car, new Pair(values.car)));
            body = new Pair(set, body);
            names = names.cdr;
            values = values.cdr;
          }
          return frame.extend({
            exp: body,
            env: env,
            fn: run,
            val: new Pair
          });
        }
      };
    })(), let0 = _ref7.let0, letrec = _ref7.letrec;

    return Interpreter;

  })();

  run = function(frame) {
    var program, _ref7;
    program = frame.exp;
    if (program != null ? program.isNotNull() : void 0) {
      frame = frame.extend({
        exp: program.car,
        fn: program.car["eval"]
      });
      if ((_ref7 = program.cdr) != null ? _ref7.isNotNull() : void 0) {
        frame["continue"]({
          exp: program.cdr,
          fn: run
        });
      }
      return frame;
    } else {
      return frame.returnValue(frame.val);
    }
  };

  map = function(frame) {
    var ctx, program, result, value, _ref7;
    program = frame.exp;
    ctx = frame.cont.ctx;
    value = frame.val;
    if (value) {
      result = new Pair(value, frame.cont.val);
    }
    if (program != null ? program.isNotNull() : void 0) {
      return frame.extend({
        exp: program.car,
        fn: program.car["eval"]
      })["continue"]({
        exp: program.cdr,
        fn: map
      }, {
        ctx: ctx,
        val: result
      });
    } else {
      frame.cont.val = (_ref7 = result != null ? result.reverse() : void 0) != null ? _ref7 : new Pair;
      frame.cont.ctx = ctx;
      return frame.cont;
    }
  };

  parse = function(string) {
    var eof, eol, peek, read, readList, readNumberOrSymbol, readQuote, readString, readToken, rest, token, tokens, _i, _len, _results;
    tokens = [];
    rest = string;
    eof = {};
    eol = {};
    peek = function(pattern) {
      var match;
      match = rest.match(pattern != null ? pattern : /^./);
      return match != null ? match[0] : void 0;
    };
    read = function(pattern) {
      var result;
      if (result = peek(pattern)) {
        rest = rest.slice(result.length);
        return result;
      }
    };
    readList = function() {
      var result, token;
      result = [];
      while (true) {
        token = readToken();
        if ((token == null) || token === eof) {
          throw "expected close paren";
        } else if (token === eol) {
          break;
        } else {
          result.push(token);
          if (!(read(/^\s+/) || peek() === ")")) {
            throw "expected space or close paren";
          }
        }
      }
      return result;
    };
    readString = function() {
      var source;
      source = read(/^([^\\"]|\\.)*"/);
      if (source != null) {
        return {
          s: source.slice(0, -1).replace(/\\"/g, '"').replace(/\\(.)/g, '$1')
        };
      } else {
        throw "expected close quote";
      }
    };
    readQuote = function(type) {
      var token;
      token = readToken();
      if ((token == null) || token === eof) {
        throw "expected token after " + type;
      } else if (token === eol) {
        throw "unexpected close paren";
      } else {
        return [type, token];
      }
    };
    readNumberOrSymbol = function() {
      var number;
      number = read(/^-?\d+(\.\d*)?/);
      if (number != null) {
        return parseFloat(number, 10);
      } else {
        return read(/^[^)\s]+/);
      }
    };
    readToken = function() {
      switch (peek()) {
        case null:
          return eof;
        case '(':
          read();
          return readList();
        case ')':
          read();
          return eol;
        case '"':
          read();
          return readString();
        case "'":
          read();
          return readQuote("quote");
        default:
          return readNumberOrSymbol();
      }
    };
    while (true) {
      read(/^\s*/);
      token = readToken();
      if ((token == null) || token === eof) {
        break;
      }
      if (token === eol) {
        throw "unexpected close paren";
      }
      tokens.push(token);
    }
    _results = [];
    for (_i = 0, _len = tokens.length; _i < _len; _i++) {
      token = tokens[_i];
      _results.push(parseValue(token));
    }
    return _results;
  };

  parseValue = function(value) {
    var type;
    type = typeof value;
    if (Array.isArray(value)) {
      return parseArray(value);
    } else if (type === "string") {
      return Symbol.fromString(value);
    } else if (type === "object" && typeof value.s === "string") {
      return new String(value.s);
    } else if (type === "number") {
      return new Number(value);
    } else {
      throw "unsupported value";
    }
  };

  parseArray = function(array) {
    var el, lastPair, pair, result, value, _i, _len;
    pair = new Pair;
    result = pair;
    lastPair = null;
    for (_i = 0, _len = array.length; _i < _len; _i++) {
      el = array[_i];
      if (!pair) {
        throw "invalid dotted pair";
      }
      value = parseValue(el);
      if (value instanceof Symbol && value.toString() === ".") {
        if (lastPair && lastPair !== pair) {
          pair = lastPair;
        } else {
          throw "invalid dotted pair";
        }
      } else if (lastPair === pair) {
        pair.cdr = value;
        pair = null;
      } else {
        pair.car = value;
        pair.cdr = new Pair;
        lastPair = pair;
        pair = pair.cdr;
      }
    }
    return result;
  };

  prelude = parse("(define (filter fn list)\n  (fold (lambda (result value) (if (fn value) (cons value result) result)) '() (reverse list)))\n\n(define (fold fn result list)\n  (if (null? list)\n    result\n    (fold fn (fn result (car list)) (cdr list))))\n\n(define (for-each fn list)\n  (fold (lambda (result value) (fn value)) #t list))\n\n(define (length list)\n  (fold (lambda (result value) (+ result 1)) 0 list))\n\n(define (list . values)\n  values)\n\n(define (map fn list)\n  (fold (lambda (result value) (cons (fn value) result)) '() (reverse list)))\n\n(define (range from to)\n  (define (range-iter from to result)\n    (if (>= from to)\n      (cons to result)\n      (range-iter from (- to 1) (cons to result))))\n  (if (> from to)\n    (reverse (range-iter to from '()))\n    (range-iter from to '())))\n\n(define (reverse list)\n  (fold (lambda (result value) (cons value result)) '() list))");

  this.S = {
    Interpreter: Interpreter,
    parse: parse
  };

}).call(this);
