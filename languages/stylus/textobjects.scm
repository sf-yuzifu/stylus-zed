(rule_set
  (block) @function.inside) @function.around

(mixin_definition
  (block) @function.inside) @function.around

(generic_at_rule
  (block) @class.inside) @class.around

(keyframes_statement
  (keyframes_block) @class.inside) @class.around

(comment)+ @comment.around
