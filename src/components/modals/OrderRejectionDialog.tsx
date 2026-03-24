'use client'

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, X } from 'lucide-react';

interface OrderRejectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReject: (reason: string, comment: string) => Promise<void>;
}

const REJECTION_REASONS = [
  'Product out of stock',
  'Insufficient inventory',
  'Invalid order details',
  'Payment issue',
  'Customer request',
  'Quality concerns',
  'Other',
];

export const OrderRejectionDialog = ({
  open,
  onOpenChange,
  onReject,
}: OrderRejectionDialogProps) => {
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [rejectionComment, setRejectionComment] = useState<string>('');
  const [isRejecting, setIsRejecting] = useState(false);

  const handleReject = async () => {
    if (!rejectionReason) {
      return;
    }

    setIsRejecting(true);
    try {
      await onReject(rejectionReason, rejectionComment);
      // Reset form
      setRejectionReason('');
      setRejectionComment('');
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in parent component
    } finally {
      setIsRejecting(false);
    }
  };

  const handleClose = () => {
    if (!isRejecting) {
      setRejectionReason('');
      setRejectionComment('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reject Order</DialogTitle>
          <DialogDescription>
            Please provide a reason for rejecting this order. You can also add an optional comment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="rejection-reason">
              Rejection Reason <span className="text-destructive">*</span>
            </Label>
            <Select
              value={rejectionReason}
              onValueChange={setRejectionReason}
              disabled={isRejecting}
            >
              <SelectTrigger id="rejection-reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REJECTION_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rejection-comment">Additional Comment (Optional)</Label>
            <Textarea
              id="rejection-comment"
              placeholder="Add any additional details about the rejection..."
              value={rejectionComment}
              onChange={(e) => setRejectionComment(e.target.value)}
              disabled={isRejecting}
              rows={4}
              className="resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isRejecting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={isRejecting || !rejectionReason}
          >
            {isRejecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Rejecting...
              </>
            ) : (
              <>
                <X className="mr-2 h-4 w-4" />
                Reject Order
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
