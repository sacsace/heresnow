import { AppFooter } from "@/components/AppFooter";
import { appBody, appBodyWidth, appShell } from "@/lib/uiStyles";
import type { ReactNode } from "react";

type Props = {
  header: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  shellClassName?: string;
};

/** Authenticated app layout — header · body · footer */
export function AppShell({ header, children, bodyClassName = "", shellClassName = "" }: Props) {
  return (
    <div className={`${appShell} ${shellClassName}`.trim()}>
      {header}
      <main className={appBody}>
        <div className={appBodyWidth}>
          <div className={`w-full min-w-0 ${bodyClassName}`.trim()}>{children}</div>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
