(rule_set
  (block) @function.inside) @function.around

(mixin_definition
  (block) @function.inside) @function.around

(block_call_statement
  (block) @function.inside) @function.around

(anonymous_function
  (expression_block) @function.inside) @function.around

(generic_at_rule
  (block) @class.inside) @class.around

(keyframes_statement
  (keyframes_block) @class.inside) @class.around

(comment)+ @comment.around
