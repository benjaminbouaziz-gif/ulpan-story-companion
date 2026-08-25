import * as React from "react";

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

import { brand, button, code, container, footer, h1, main, text, wordmark } from "./theme";

interface MagicLinkEmailProps {
  siteName: string;
  confirmationUrl: string;
  token?: string | undefined;
}

export const MagicLinkEmail = ({ siteName, confirmationUrl, token }: MagicLinkEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre lien d’accès aux contenus du livre</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={wordmark}>{siteName}</Text>
        <Heading style={h1}>Votre lien d’accès</Heading>
        <Text style={text}>
          Ouvrez le lien ci-dessous pour accéder aux contenus offerts avec votre livre. Il expire
          après un court délai.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Ouvrir mon compagnon
        </Button>
        {token ? (
          <>
            <Text style={{ ...text, margin: "28px 0 8px", color: brand.muted, fontSize: "14px" }}>
              Ou saisissez ce code à six chiffres sur la page d’activation :
            </Text>
            <Text style={code}>{token}</Text>
          </>
        ) : null}
        <Text style={footer}>
          Si vous n’êtes pas à l’origine de cette demande, ignorez ce courrier.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default MagicLinkEmail;
