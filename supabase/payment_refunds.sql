ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS refunded_amount INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_type TEXT,
  ADD COLUMN IF NOT EXISTS refund_reason TEXT;

CREATE OR REPLACE FUNCTION apply_payment_refund(
  p_payment_id TEXT,
  p_refund_amount INTEGER,
  p_credits_to_remove INTEGER,
  p_payment_lot_id UUID,
  p_refund_type TEXT,
  p_refund_reason TEXT DEFAULT NULL,
  p_refunded_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  payment_user_id TEXT;
  payment_amount INTEGER;
BEGIN
  SELECT user_id, amount
    INTO payment_user_id, payment_amount
  FROM payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF payment_user_id IS NULL THEN
    RAISE EXCEPTION 'payment_not_found';
  END IF;

  UPDATE payments
  SET status = COALESCE(p_refund_type, 'refunded'),
      refunded_amount = GREATEST(0, LEAST(COALESCE(p_refund_amount, 0), payment_amount)),
      refunded_at = COALESCE(p_refunded_at, NOW()),
      refund_type = COALESCE(p_refund_type, 'refunded'),
      refund_reason = p_refund_reason
  WHERE id = p_payment_id;

  UPDATE credit_lots
  SET remaining_credits = GREATEST(0, remaining_credits - GREATEST(COALESCE(p_credits_to_remove, 0), 0)),
      updated_at = COALESCE(p_refunded_at, NOW())
  WHERE id = p_payment_lot_id;

  RETURN refresh_user_credit_balance(payment_user_id);
END;
$$;
