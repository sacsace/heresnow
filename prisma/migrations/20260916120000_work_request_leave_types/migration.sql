-- Extend WorkRequestType for remote work, vacation, and half-day leave
ALTER TYPE "WorkRequestType" ADD VALUE 'REMOTE_WORK';
ALTER TYPE "WorkRequestType" ADD VALUE 'VACATION';
ALTER TYPE "WorkRequestType" ADD VALUE 'HALF_DAY_LEAVE';
