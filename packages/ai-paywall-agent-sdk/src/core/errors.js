export class PaywallError extends Error {
  constructor(message) { super(message); this.name = 'PaywallError'; }
}

export class BudgetExceededError extends PaywallError {
  constructor(message) { super(message); this.name = 'BudgetExceededError'; }
}

export class PaymentRefusedError extends PaywallError {
  constructor(message) { super(message); this.name = 'PaymentRefusedError'; }
}

export class UnsupportedChallengeError extends PaywallError {
  constructor(message) { super(message); this.name = 'UnsupportedChallengeError'; }
}
