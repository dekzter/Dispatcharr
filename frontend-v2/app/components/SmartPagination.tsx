import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

interface SmartPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

function generatePageNumbers(
  currentPage: number,
  totalPages: number
): (number | 'ellipsis')[] {
  const pages: (number | 'ellipsis')[] = [];
  const siblings = 1;

  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  pages.push(1);

  const leftSibling = Math.max(currentPage - siblings, 2);
  const rightSibling = Math.min(currentPage + siblings, totalPages - 1);

  if (leftSibling > 2) {
    pages.push('ellipsis');
  }

  for (let i = leftSibling; i <= rightSibling; i++) {
    pages.push(i);
  }

  if (rightSibling < totalPages - 1) {
    pages.push('ellipsis');
  }

  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
}

export function SmartPagination({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
}: SmartPaginationProps) {
  const pages = generatePageNumbers(currentPage, totalPages);

  const canGoFirst = currentPage > 1 && !disabled;
  const canGoPrevious = currentPage > 1 && !disabled;
  const canGoNext = currentPage < totalPages && !disabled;
  const canGoLast = currentPage < totalPages && !disabled;

  return (
    <div>
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(1)}
            disabled={!canGoFirst}
            aria-label="Go to first page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
        </PaginationItem>

        <PaginationItem>
          <Button
            variant="ghost"
            onClick={() => onPageChange(currentPage - 1)}
            aria-disabled={!canGoPrevious}
            className={
              !canGoPrevious
                ? 'pointer-events-none opacity-50'
                : 'cursor-pointer'
            }
          >
            <ChevronLeft />
          </Button>
        </PaginationItem>

        {pages.map((page, index) => {
          if (page === 'ellipsis') {
            return (
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            );
          }

          return (
            <PaginationItem key={page}>
              <PaginationLink
                onClick={() => onPageChange(page)}
                isActive={page === currentPage}
                className="cursor-pointer"
                aria-label={`Go to page ${page}`}
                aria-current={page === currentPage ? 'page' : undefined}
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          );
        })}

        <PaginationItem>
          <Button
            variant="ghost"
            onClick={() => onPageChange(currentPage + 1)}
            aria-disabled={!canGoNext}
            className={
              !canGoNext ? 'pointer-events-none opacity-50' : 'cursor-pointer'
            }
          >
            <ChevronRight />
          </Button>
        </PaginationItem>

        <PaginationItem>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(totalPages)}
            disabled={!canGoLast}
            aria-label="Go to last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
    </div>
  );
}
