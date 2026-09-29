import * as React from "react";
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import { brand, button, code, container, footer, h1, main, text, wordmark } from "./theme";
import { MAIL, type MailLang } from "./lecteur-texts";

interface SignupEmailProps {
  siteName: string;
  siteUrl: string;
  recipient: string;
  confirmationUrl: string;
  token?: string | undefined;
  lang?: MailLang;
}

/** Même structure que le lien d'accès : un nouveau lecteur reçoit ce mail-ci. */
export const SignupEmail = ({ siteName, confirmationUrl, token, lang = "fr" }: SignupEmailProps) => {
  const m = MAIL[lang];
  return (
    <Html lang={lang} dir="ltr">
      <Head />
      <Preview>{m.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={wordmark}>{siteName}</Text>
          <Heading style={h1}>{m.title}</Heading>
          <Text style={text}>{m.body}</Text>
          <Button style={button} href={confirmationUrl}>{m.button}</Button>
          {token ? (
            <>
              <Text style={{ ...text, margin: "28px 0 8px", color: brand.muted, fontSize: "14px" }}>{m.orCode}</Text>
              <Text style={code}>{token}</Text>
            </>
          ) : null}
          <Text style={footer}>{m.footer}</Text>
        </Container>
      </Body>
    </Html>
  );
};

export default SignupEmail;
