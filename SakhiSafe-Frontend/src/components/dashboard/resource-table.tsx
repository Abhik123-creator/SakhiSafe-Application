import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
}

interface ResourceTableProps<T extends { id: string }> {
  rows: T[];
  columns: Column<T>[];
  detailBasePath?: string;
}

export function ResourceTable<T extends { id: string }>({ rows, columns, detailBasePath }: ResourceTableProps<T>) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key}>{column.header}</TableHead>
            ))}
            {detailBasePath && <TableHead className="w-24 text-right">Action</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              {columns.map((column) => (
                <TableCell key={column.key}>{column.cell(row)}</TableCell>
              ))}
              {detailBasePath && (
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`${detailBasePath}/${row.id}`} prefetch={false}>
                      View
                    </Link>
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
