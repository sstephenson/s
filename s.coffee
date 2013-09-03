# The base class for Scheme atoms is non-applicable and self-evaluating.
class Atom
  isNotNull: ->
    true

  isNull: ->
    not @isNotNull()

  apply: (frame) ->
    frame.raiseError "can't apply #{@constructor.name}"

  eval: (frame) ->
    frame.returnValue this

  eq: (atom) ->
    this is atom

  eqv: (atom) ->
    @eq atom

  isA: (type) ->
    @constructor is type

  toString: ->
    @inspect()


# Values are atoms that wrap a single JavaScript value.
class Value extends Atom
  constructor: (@value) ->

  eqv: (atom) ->
    super or @constructor is atom.constructor and @value is atom.value

  inspect: ->
    @value.toString()


# The boolean type represents true (#t) and false (#f).
class Boolean extends Value


# Scheme strings.
class String extends Value
  inspect: ->
    return "\"#{@value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}\""

  toString: ->
    return @value

  append: (value) ->
    new @constructor @value + value.toString()


# Symbols are identity-mapped strings that are never garbage collected.
class Symbol extends String
  @symbols: {}

  @fromString: (string) ->
    @symbols[string] ?= new this string

  eval: (frame) ->
    if value = frame.env.get @value
      frame.returnValue value
    else
      frame.raiseError "unbound variable `#{@value}'"

  inspect: ->
    @value.toString()


# Scheme numbers, both integer and floating-point.
class Number extends Value
  add: (number) ->
    new @constructor @value + number.value

  subtract: (number) ->
    new @constructor @value - number.value

  multiply: (number) ->
    new @constructor @value * number.value

  divide: (number) ->
    new @constructor @value / number.value

  modulo: (number) ->
    new @constructor @value % number.value

  gt: (number) ->
    @value > number.value

  lt: (number) ->
    @value < number.value

  gte: (number) ->
    @value >= number.value

  lte: (number) ->
    @value <= number.value


# Scheme pairs are linked to create lists, and serve as the basis for
# representing programs and creating higher-order data structures.
class Pair extends Atom
  @fromArray: (values) ->
    result = new this
    for value in values by -1
      result = new this value, result
    result

  constructor: (@car, @cdr) ->

  eval: (frame) ->
    if @isNotNull()
      frame
        .extend(exp: @car, fn: @car.eval)
        .continue(exp: this, fn: @eval1)
    else
      frame.returnValue new @constructor

  eval1: (frame) ->
    frame.val.apply frame, @cdr

  eq: (atom) ->
    super or @isNull() and atom.isNull()

  isNotNull: ->
    @car? or @cdr?

  append: (value) ->
    values = @toArray()
    if value instanceof @constructor
      values = values.concat value.toArray()
    else
      values.push value
    @constructor.fromArray values

  reverse: ->
    pair = this
    result = null

    while pair?.isNotNull()
      if pair instanceof @constructor
        result = new @constructor pair.car, result
        pair = pair.cdr
      else
        result = new @constructor pair, result
        pair = null

    result ? new @constructor

  isQuote: ->
    @car instanceof Symbol and @car.toString() is "'" and @cdr?.isNotNull()

  inspect: ->
    return "'#{@cdr.car.inspect()}" if @isQuote()
    pair = this
    result = []

    while pair?.isNotNull()
      {car, cdr} = pair
      result.push car.inspect()

      if cdr?.isNotNull()
        if cdr instanceof @constructor
          pair = cdr
        else
          result.push ".", cdr.inspect()
          break
      else
        break

    "(#{result.join " "})"

  toArray: ->
    pair = this
    values = []

    while pair?.isNotNull()
      {car, cdr} = pair
      values.push car
      pair = if cdr instanceof @constructor then cdr else null

    values


# Procedures encapsulate built-in functions.
class Procedure extends Atom
  constructor: (@name, @value) ->

  apply: (frame, args) ->
    @value frame, args

  isA: (type) ->
    this instanceof type

  inspect: ->
    "#<Procedure: #{@name}>"


# A binary operator takes two arguments of the same type.
class BinaryOp extends Procedure
  apply: (frame, args) ->
    if args.car
      frame.eval args.car, exp: args.cdr, fn: apply1, ctx: this
    else
      frame.raiseError "`#{@name}' expects 2 arguments"

  apply1 = (frame) ->
    args = frame.exp
    if args.car
      frame.eval args.car, exp: frame.val, fn: apply2, ctx: this
    else
      frame.raiseError "`#{@name}' expects 2 arguments"

  apply2 = (frame) ->
    a = frame.exp
    b = frame.val

    if a.constructor is b.constructor
      @compute frame, a, b
    else
      frame.raiseError "`#{@name}' argument type mismatch"

  compute: (frame, a, b) ->
    if fn = a[@value]
      frame.returnValue fn.call a, b
    else
      frame.raiseError "`#{@name}' not supported"


# A boolean operator is a binary operator that returns #t or #f.
class BooleanOp extends BinaryOp
  compute: (frame, a, b) ->
    if fn = a[@value]
      frame.returnBoolean fn.call(a, b)
    else
      frame.raiseError "`#{@name}' not supported"


# Type predicates are single-argument functions that answer the question:
# is this value of a particular type?
class TypePred extends Procedure
  apply: (frame, args) ->
    if args.car
      frame.eval args.car, exp: args.cdr, fn: apply1, ctx: this
    else
      frame.raiseError "`#{@name}' expects 1 argument"

  apply1 = (frame) ->
    frame.returnBoolean frame.val.isA @value


# Closures (a.k.a. lambdas) are user-specified functions that capture and
# extend the environment they're defined in.
class Closure extends Atom
  constructor: (args, @body, @env) ->
    @args = new Arguments args

  apply: (frame, args) ->
    frame
      .extend(exp: args, fn: map, val: null)
      .continue(val: new Pair, env: @env.extend(), fn: apply1, ctx: this)

  apply1 = (frame) ->
    @args.apply frame, frame.val, exp: @body, fn: run

  inspect: ->
    "#<Closure: #{@args.inspect()}>"


# Continuations are functions that capture and extend the current execution
# frame when created (using call/cc), and restore the frame when applied.
class Continuation extends Atom
  constructor: (@frame) ->

  apply: (frame, args) ->
    if args.car
      frame.eval args.car, fn: apply1, ctx: this
    else
      frame.raiseError "continuation expects 1 argument"

  apply1 = (frame) ->
    @frame.extend ctx: @frame.ctx, val: frame.val

  inspect: ->
    "#<Continuation>"


# Helper class for parsing and applying closure argument lists.
class Arguments
  constructor: (@definition) ->
    @carNames = []
    arg = definition

    while arg?.isNotNull()
      if arg instanceof Symbol
        @cdrName = arg.toString()
        break
      else if arg instanceof Pair
        name = arg.car
        if name instanceof Symbol
          @carNames.push name.toString()
          arg = arg.cdr
        else
          throw "syntax error"
      else
        throw "syntax error"

    @arity = @carNames.length
    @arity = -(@arity + 1) if @cdrName

  apply: (frame, values, registers) ->
    if @arity isnt 0
      value = values

      for argName in @carNames
        if value?.isNotNull() and value.car
          frame.env.define argName, value.car
          value = value.cdr
        else
          arity = if @arity < 0 then -@arity - 1 else @arity
          return frame.raiseError "expected " + ["at least " if @arity < 0] +
            arity + " argument" + ["s" unless arity is 1]

      if @cdrName
        frame.env.define @cdrName, value ? new Pair

    frame.extend registers

  inspect: ->
    @definition.inspect()


# An environment is a table of variables and values, with a pointer to
# a parent environment whose variables are inherited and shadowed.
class Environment
  constructor: (@parent) ->
    @values = {}

  define: (name, value) ->
    @values[name] = value

  set: (name, value) ->
    environment = this
    while environment
      if environment.values[name]? or not environment.parent
        return environment.values[name] = value
      environment = environment.parent

  get: (name) ->
    environment = this
    while environment
      value = environment.values[name]
      return value if value?
      environment = environment.parent

  extend: ->
    new @constructor this

  keys: ->
    Object.keys @values

  inspect: ->
    if @parent
      "{#{@keys().concat(@parent.inspect()).join ", "}}"
    else
      "{<global>}"


# A frame is a set of registers that represent the next interpreter
# instruction to call, and what data to call it with. The registers are:
# * `env`: The environment for the instruction.
# * `exp`: The expression to be evaluated or operated on.
# * `cont`: The next frame in the execution stack.
# * `val`: Temporary storage, or the result of the previous instruction.
# * `fn`: The interpreter function to call.
# * `ctx`: The value of `this` for `fn`.
class Frame
  constructor: (@interpreter, {@env, @exp, @cont, @val, @fn, @ctx} = {}) ->
    @env ?= interpreter.env

  apply: ->
    if @fn
      cont: @fn.call @ctx ? @exp, this
    else
      val: @val

  dup: ->
    @extend ctx: @ctx

  extend: (registers = {}) ->
    new @constructor @interpreter,
      env:  if "env"  of registers then registers.env  else @env
      exp:  if "exp"  of registers then registers.exp  else @exp
      cont: if "cont" of registers then registers.cont else @cont
      val:  if "val"  of registers then registers.val  else @val
      fn:   if "fn"   of registers then registers.fn   else @fn
      ctx:  if "ctx"  of registers then registers.ctx

  continue: (registers, continuationRegisters = {}) ->
    cont = @extend registers
    cont.cont = @cont.extend continuationRegisters
    cont.cont.ctx ?= @cont.ctx
    @cont = cont
    this

  eval: (exp, registers, continuationRegisters) ->
    @extend(exp: exp, fn: exp.eval).continue(registers, continuationRegisters)

  returnValue: (value) ->
    @cont.val = value
    @cont

  returnBoolean: (value) ->
    @returnValue if value then @interpreter.t else @interpreter.f

  raiseError: (error) ->
    # All errors end up at this function. For now, we just throw a JavaScript
    # exception, but this could be changed in the future to support exception
    # handling in the language.
    throw error


# The interpreter defines a basic environment and functions for evaluating
# values and programs asynchronously.
class Interpreter
  constructor: ->
    @env = new Environment
    @env.define "#f",    @f = new Boolean   "#f"
    @env.define "#t",    @t = new Boolean   "#t"
    @env.define "and",        new Procedure "and",        and0
    @env.define "append",     new Procedure "append",     append
    @env.define "apply",      new Procedure "apply",      apply
    @env.define "begin",      new Procedure "begin",      begin
    @env.define "boolean?",   new TypePred  "boolean?",   Boolean
    @env.define "call/cc",    new Procedure "call/cc",    callcc
    @env.define "car",        new Procedure "car",        car
    @env.define "cdr",        new Procedure "cdr",        cdr
    @env.define "cons",       new Procedure "cons",       cons
    @env.define "define",     new Procedure "define",     define
    @env.define "eq?",        new Procedure "eq?",        eqp
    @env.define "eqv?",       new Procedure "eqv?",       eqvp
    @env.define "if",         new Procedure "if",         if0
    @env.define "lambda",     new Procedure "lambda",     lambda
    @env.define "let",        new Procedure "let",        let0
    @env.define "letrec",     new Procedure "letrec",     letrec
    @env.define "not",        new Procedure "not",        not0
    @env.define "null?",      new Procedure "null?",      nullp
    @env.define "number?",    new TypePred  "number?",    Number
    @env.define "or",         new Procedure "or",         or0
    @env.define "pair?",      new TypePred  "pair?",      Pair
    @env.define "procedure?", new TypePred  "procedure?", Procedure
    @env.define "quote",      new Procedure "quote",      quote
    @env.define "set!",       new Procedure "set!",       set
    @env.define "string",     new Procedure "string",     string
    @env.define "string?",    new TypePred  "string?",    String
    @env.define "symbol",     new Procedure "symbol",     symbol
    @env.define "symbol?",    new TypePred  "symbol?",    Symbol
    @env.define "+",          new BinaryOp  "+",          "add"
    @env.define "-",          new BinaryOp  "-",          "subtract"
    @env.define "*",          new BinaryOp  "*",          "multiply"
    @env.define "/",          new BinaryOp  "/",          "divide"
    @env.define "%",          new BinaryOp  "%",          "modulo"
    @env.define "=",          new BooleanOp "=",          "eqv"
    @env.define ">",          new BooleanOp ">",          "gt"
    @env.define "<",          new BooleanOp "<",          "lt"
    @env.define ">=",         new BooleanOp ">=",         "gte"
    @env.define "<=",         new BooleanOp "<=",         "lte"
    @run prelude, ->

  # The `run` method takes a program (an array of atoms) and evaluates each
  # value in order from left to right, returning the last result to the
  # specified callback.
  run: (program, callback, result) ->
    if value = program[0]
      @eval value, (err, result) =>
        if err
          callback err
        else
          @run program.slice(1), callback, result
    else
      callback null, result

  # Evaluation happens by creating a stack of frames and passing it off to
  # the trampoline function.
  eval: (value, callback) ->
    end = new Frame this
    run = new Frame this, exp: value, fn: value.eval, cont: end
    trampoline new Date, callback, cont: run

  # "Trampolining" is a method of flattening a call stack through
  # continuation-passing style. Each evaluation or application returns a frame
  # representing the next interpreter instruction to be performed. The
  # trampoline function is a loop that processes the next frame or returns
  # the result if there are no more frames to run.
  trampoline = (date, callback, bounce) ->
    while bounce
      if bounce.val
        callback null, bounce.val
        break
      else if new Date - date > 100
        # Break every tenth of a second to let the browser catch its breath.
        setTimeout (-> trampoline new Date, callback, bounce), 0
        break
      else
        try
          bounce = bounce.cont.apply()
        catch error
          callback error, null
          break


  # Definitions for the built-in procedures follow.

  # (and ...) returns #t if none of the arguments evaluate to #f.
  and0 = (frame, args) ->
    frame.extend exp: args, fn: and1, val: frame.interpreter.t

  and1 = (frame) ->
    if frame.exp.car
      frame.eval frame.exp.car, exp: frame.exp.cdr, fn: and2
    else
      frame.returnValue frame.val

  and2 = (frame) ->
    if frame.val is frame.interpreter.f
      frame.returnValue frame.val
    else
      and1 frame

  # (append ...) concatenates lists.
  append = (frame, args) ->
    frame.extend exp: args, fn: append1, val: new Pair

  append1 = (frame) ->
    if frame.exp?.isNotNull()
      frame.eval frame.exp.car, { exp: frame.exp.cdr, fn: append2 }, val: frame.val
    else
      frame.returnValue frame.val

  append2 = (frame) ->
    frame.extend val: frame.cont.val.append(frame.val), fn: append1

  # (apply fn list) invokes fn with the given list as its arguments.
  apply = (frame, args) ->
    if args.car
      frame.eval args.car, exp: args.cdr, fn: apply1
    else
      frame.raiseError "`apply' expects 2 arguments"

  apply1 = (frame) ->
    if frame.exp.car
      frame.eval frame.exp.car, fn: apply2, exp: frame.val
    else
      frame.raiseError "`apply' expects 2 arguments"

  apply2 = (frame) ->
    if frame.val instanceof Pair
      frame.exp.apply frame, frame.val
    else
      frame.raiseError "`apply' second argument must be a list"

  # (begin ...) creates a new environment, evaluates each expression inside,
  # and returns the value of the last expression.
  begin = (frame, args) ->
    frame.extend exp: args, env: frame.env.extend(), fn: run, val: new Pair


  # (call/cc fn) invokes fn with a continuation of the current execution
  # frame as its sole argument.
  callcc = (frame, args) ->
    if args.car
      frame.eval args.car, fn: callcc1
    else
      frame.raiseError "`call/cc' expects 1 argument"

  callcc1 = (frame) ->
    cont = new Continuation frame.cont.dup()
    frame.val.apply frame, new Pair cont

  # (car pair) returns the car of the given pair.
  car = (frame, args) ->
    if args.car
      frame.eval args.car, fn: car1
    else
      frame.raiseError "`car' expects a pair argument"

  car1 = (frame) ->
    if frame.val instanceof Pair
      frame.returnValue frame.val.car ? new Pair
    else
      frame.raiseError "`car' expects a pair argument"

  # (cdr pair) returns the cdr of the given pair.
  cdr = (frame, args) ->
    if args.car
      frame.eval args.car, fn: cdr1
    else
      frame.raiseError "`cdr' expects a pair argument"

  cdr1 = (frame) ->
    if frame.val instanceof Pair
      frame.returnValue frame.val.cdr ? new Pair
    else
      frame.raiseError "`cdr' expects a pair argument"

  # (cons car cdr) creates a new pair with the given car and cdr.
  cons = (frame, args) ->
    if args.car
      frame.eval args.car, exp: args.cdr, fn: cons1
    else
      frame.raiseError "`cons' expects 2 arguments"

  cons1 = (frame) ->
    args = frame.exp
    if args.car
      frame.eval args.car, { fn: cons2 }, val: new Pair frame.val
    else
      frame.raiseError "`cons' expects 2 arguments"

  cons2 = (frame) ->
    pair = frame.cont.val
    pair.cdr = frame.val
    frame.cont

  # (define name value) sets the variable specified by the given symbol name
  # to the given value in the current environment.
  # (define (name <args>) <body>) is a special form for defining procedures,
  # equivalent to (define name (lambda <args> <body>)).
  define = (frame, args) ->
    if args.car
      arg = args.car

      if arg instanceof Pair
        name = arg.car

        if body = args.cdr
          try
            closure = new Closure arg.cdr, body, frame.env
            return define1 frame.extend exp: name, val: closure
          catch error
            return frame.raiseError error

      else if args.cdr instanceof Pair and args.cdr.isNotNull()
        return frame.eval args.cdr.car, exp: arg, fn: define1

    frame.raiseError "`define' expects 2 arguments"

  define1 = (frame) ->
    name = frame.exp
    value = frame.val

    if name instanceof Symbol
      frame.returnValue frame.env.define name.toString(), value
    else
      frame.raiseError "`define' name argument must be a symbol"

  # (eq? a b) returns #t if a and b are the same object (identity equality).
  eqp = (frame, args) ->
    if args.car
      frame.eval args.car, exp: args.cdr, fn: eqp1
    else
      frame.raiseError "`eq?' expects 2 arguments"

  eqp1 = (frame) ->
    args = frame.exp
    if args.car
      frame.eval args.car, exp: frame.val, fn: eqp2
    else
      frame.raiseError "`eq?' expects 2 arguments"

  eqp2 = (frame) ->
    a = frame.exp
    b = frame.val
    frame.returnBoolean a.eq b

  # (eqv? a b) returns #t if a and b are equivalent values.
  eqvp = (frame, args) ->
    if args.car
      frame.eval args.car, exp: args.cdr, fn: eqvp1
    else
      frame.raiseError "`eqv?' expects 2 arguments"

  eqvp1 = (frame) ->
    args = frame.exp
    if args.car
      frame.eval args.car, exp: frame.val, fn: eqvp2
    else
      frame.raiseError "`eqv?' expects 2 arguments"

  eqvp2 = (frame) ->
    a = frame.exp
    b = frame.val
    frame.returnBoolean a.eqv b

  # (if cond exp1 exp2) evaluates exp2 if cond evaluates to #f, or exp1
  # otherwise.
  if0 = (frame, args) ->
    if args.car
      frame.eval args.car, exp: args.cdr, fn: if1
    else
      frame.raiseError "`if' expects 2 or 3 arguments"

  if1 = (frame) ->
    args = frame.exp
    val = frame.val

    if args.car
      if val is frame.interpreter.f
        if args.cdr and args.cdr instanceof Pair
          exp = args.cdr.car
          frame.extend exp: exp, fn: exp.eval
        else
          frame.returnValue val
      else
        exp = args.car
        frame.extend exp: exp, fn: exp.eval
    else
      frame.raiseError "`if' expects 2 or 3 arguments"

  # (lambda <args> <body>) creates a closure with the given argument list
  # and body.
  lambda = (frame, args) ->
    if args.car and args.cdr instanceof Pair
      frame.returnValue new Closure args.car, args.cdr, frame.env
    else
      frame.raiseError "`lambda' expects at least 2 arguments"

  # (not value) returns #t if value is #f, or #f otherwise.
  not0 = (frame, args) ->
    if args.car
      frame.eval args.car, fn: not1
    else
      frame.raiseError "`not' expects 1 argument"

  not1 = (frame) ->
     frame.returnBoolean frame.val is frame.interpreter.f

  # (null? value) returns #t if value is an empty cons pair.
  nullp = (frame, args) ->
    if args.car
      frame.eval args.car, fn: nullp1
    else
      frame.raiseError "`null?' expects 1 argument"

  nullp1 = (frame) ->
    frame.returnBoolean not frame.val?.isNotNull()

  # (or ...) returns #t if any of the arguments evaluate to #f.
  or0 = (frame, args) ->
    frame.extend exp: args, fn: or1, val: frame.interpreter.f

  or1 = (frame) ->
    if frame.exp.car
      frame.eval frame.exp.car, exp: frame.exp.cdr, fn: or2
    else
      frame.returnValue frame.val

  or2 = (frame) ->
    if frame.val is frame.interpreter.f
      or1 frame
    else
      frame.returnValue frame.val

  # (quote value) returns the value without evaluating it.
  quote = (frame, args) ->
    frame.returnValue args.car

  # (set! name value) finds the nearest environment where the variable name
  # is defined (or the global environment if undefined) and sets its value
  # to the specified value.
  set = (frame, args) ->
    if args.car and args.cdr instanceof Pair and args.cdr.isNotNull()
      name = args.car
      if name instanceof Symbol
        frame.eval args.cdr.car, { fn: set1 }, val: name
      else
        frame.raiseError "first argument of `set!' must be a symbol"
    else
      frame.raiseError "`set!' expects 2 arguments"

  set1 = (frame) ->
    name = frame.cont.val.toString()
    value = frame.val
    frame.returnValue frame.env.set name, value

  # (string ...) coerces all arguments into strings and concatenates them.
  string = (frame, args) ->
    frame.extend val: new String(""), exp: args, fn: string1

  string1 = (frame) ->
    if frame.exp?.isNotNull()
      frame.eval frame.exp.car, { exp: frame.exp.cdr, fn: string2 }, val: frame.val
    else
      frame.returnValue frame.val

  string2 = (frame) ->
    frame.extend val: frame.cont.val.append(frame.val), fn: string1

  # (symbol ...) coerces all arguments into strings, concatenates them, and
  # returns the result as a symbol.
  symbol = (frame, args) ->
    frame.extend val: new Symbol(""), exp: args, fn: symbol1

  symbol1 = (frame) ->
    if frame.exp?.isNotNull()
      frame.eval frame.exp.car, { exp: frame.exp.cdr, fn: symbol2 }, val: frame.val
    else
      frame.returnValue frame.val

  symbol2 = (frame) ->
    frame.extend val: frame.cont.val.append(frame.val), fn: symbol1

  # let and letrec behave as source-level transformations.
  # (let ((n1 v1) (n2 v2) ...) <body>) is equivalent to
  # ((lambda (n1 n2 ...) <body>) v1 v2 ...).
  # (letrec ((n1 v1) (n2 v2) ...) <body>) is equivalent to
  # (begin (set! n1 v1) (set! n2 v2) (set! ...) <body>).
  {let0, letrec} = do ->
    letDummy = new Atom
    letSet = new Procedure "set!", set

    parseLetExpression = (args) ->
      bindings = args.car ? new Pair
      body = args.cdr ? new Pair
      names = new Pair
      values = new Pair
      error = null

      while bindings
        if bindings instanceof Pair
          binding = bindings.car
          bindings = bindings.cdr
          if binding instanceof Pair and binding.cdr instanceof Pair
            name = binding.car
            value = binding.cdr.car
            if name instanceof Symbol
              names = new Pair name, names
              values = new Pair value, values
            else if error = name
              break
          else if error = binding
            break
        else if error = bindings
          break

      {error, names, values, body}

    let0: (frame, args) ->
      exp = parseLetExpression args
      if exp.error
        return frame.raiseError "`let' binding `#{exp.error.inspect()}': syntax is invalid"

      closure = new Closure exp.names, exp.body, frame.env.extend()
      pair = new Pair closure, exp.values
      frame.extend exp: pair, fn: pair.eval

    letrec: (frame, args) ->
      exp = parseLetExpression args
      if exp.error
        return frame.raiseError "`letrec' binding `#{exp.error.inspect()}': syntax is invalid"

      env = frame.env.extend()
      {names, values, body} = exp

      while names?.car
        env.define names.car.toString(), letDummy
        set = new Pair letSet, new Pair names.car, new Pair values.car
        body = new Pair set, body
        names = names.cdr
        values = values.cdr

      frame.extend exp: body, env: env, fn: run, val: new Pair


# Evaluate the list of values in frame.exp in order from left to right and
# store the last result in the continuation frame's val register.
run = (frame) ->
  program = frame.exp
  if program?.isNotNull()
    frame = frame.extend exp: program.car, fn: program.car.eval
    frame.continue exp: program.cdr, fn: run if program.cdr?.isNotNull()
    frame
  else
    frame.returnValue frame.val

# Evaluate the list of values in frame.exp from left to right and store the
# result of each evaluation in a list in the continuation frame's val
# register.
map = (frame) ->
  program = frame.exp
  ctx = frame.cont.ctx
  value = frame.val
  result = new Pair value, frame.cont.val if value

  if program?.isNotNull()
    frame
      .extend(exp: program.car, fn: program.car.eval)
      .continue({ exp: program.cdr, fn: map }, ctx: ctx, val: result)
  else
    frame.cont.val = result?.reverse() ? new Pair
    frame.cont.ctx = ctx
    frame.cont


# Parse an s-expression string into an array of atoms.
parse = (string) ->
  tokens = []
  rest = string
  eof = {}
  eol = {}

  peek = (pattern) ->
    match = rest.match(pattern ? /^./)
    match?[0]

  read = (pattern) ->
    if result = peek pattern
      rest = rest.slice result.length
      result

  readList = ->
    result = []
    loop
      token = readToken()
      if not token? or token is eof
        throw "expected close paren"
      else if token is eol
        break
      else
        result.push token
        unless read(/^\s+/) or peek() is ")"
          throw "expected space or close paren"
    result

  readString = ->
    source = read /^([^\\"]|\\.)*"/
    if source?
      s: source.slice(0, -1).replace(/\\"/g, '"').replace(/\\(.)/g, '$1')
    else
      throw "expected close quote"

  readQuote = (type) ->
    token = readToken()
    if not token? or token is eof
      throw "expected token after #{type}"
    else if token is eol
      throw "unexpected close paren"
    else
      [type, token]

  readNumberOrSymbol = ->
    number = read /^-?\d+(\.\d*)?/
    if number?
      parseFloat number, 10
    else
      read /^[^)\s]+/

  readToken = ->
    switch peek()
      when null then eof
      when '('  then read(); readList()
      when ')'  then read(); eol
      when '"'  then read(); readString()
      when "'"  then read(); readQuote "quote"
      else readNumberOrSymbol()

  loop
    read /^\s*/
    token = readToken()
    break if not token? or token is eof
    throw "unexpected close paren" if token is eol
    tokens.push token

  parseValue token for token in tokens

parseValue = (value) ->
  type = typeof value
  if Array.isArray value
    parseArray value
  else if type is "string"
    Symbol.fromString value
  else if type is "object" and typeof value.s is "string"
    new String value.s
  else if type is "number"
    new Number value
  else
    throw "unsupported value"

parseArray = (array) ->
  pair = new Pair
  result = pair
  lastPair = null

  for el in array
    throw "invalid dotted pair" unless pair
    value = parseValue el

    if value instanceof Symbol and value.toString() is "."
      if lastPair and lastPair isnt pair
        pair = lastPair
      else
        throw "invalid dotted pair"
    else if lastPair is pair
      pair.cdr = value
      pair = null
    else
      pair.car = value
      pair.cdr = new Pair
      lastPair = pair
      pair = pair.cdr

  result


# Define a prelude of functions that can be implemented in terms of the
# interpreter's standard procedures.
prelude = parse """
  (define (filter fn list)
    (fold (lambda (result value) (if (fn value) (cons value result) result)) '() (reverse list)))

  (define (fold fn result list)
    (if (null? list)
      result
      (fold fn (fn result (car list)) (cdr list))))

  (define (for-each fn list)
    (fold (lambda (result value) (fn value)) #t list))

  (define (length list)
    (fold (lambda (result value) (+ result 1)) 0 list))

  (define (list . values)
    values)

  (define (map fn list)
    (fold (lambda (result value) (cons (fn value) result)) '() (reverse list)))

  (define (range from to)
    (define (range-iter from to result)
      (if (>= from to)
        (cons to result)
        (range-iter from (- to 1) (cons to result))))
    (if (> from to)
      (reverse (range-iter to from '()))
      (range-iter from to '())))

  (define (reverse list)
    (fold (lambda (result value) (cons value result)) '() list))
"""


# Export the interpreter and parser.
@S = {Interpreter, parse}
