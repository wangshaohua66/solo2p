import { GraphQLError, type ASTVisitor, type ASTNode } from 'graphql'

function createDepthLimitRule(maxDepth: number) {
  return (context: { reportError: (error: GraphQLError) => void }): ASTVisitor => {
    let currentDepth = 0

    return {
      Field: {
        enter: () => {
          currentDepth++
          if (currentDepth > maxDepth) {
            context.reportError(
              new GraphQLError(`Query depth exceeds maximum of ${maxDepth}`)
            )
          }
        },
        leave: () => {
          currentDepth--
        },
      },
    } as unknown as ASTVisitor
  }
}

export { createDepthLimitRule }
