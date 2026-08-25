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

interface RecoveryEmailProps {
  siteName: string;
  confirmationUrl: string;
  token?: string;
}

export const RecoveryEmail = ({ siteName, confirmationUrl, token }: RecoveryEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Réinitialiser votre mot de passe</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={wordmark}>{siteName}</Text>
        <Heading style={h1}>Nouveau mot de passe</Heading>
        <Text style={text}>
          Ouvrez le lien ci-dessous pour choisir un nouveau mot de passe. Il expire après un court
          délai.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Choisir un mot de passe
        </Button>
        {token ? (
          <>
            <Text style={{ ...text, margin: "28px 0 8px", color: brand.muted, fontSize: "14px" }}>
              Code de secours :
            </Text>
            <Text style={code}>{token}</Text>
          </>
        ) : null}
        <Text style={footer}>
          Si vous n’avez rien demandé, ignorez ce courrier : votre mot de passe reste inchangé.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default RecoveryEmail;
